package services

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/robfig/cron/v3"
	"brokerageProject/internal/storage"
)

// PartitionManagerService manages database partition lifecycle
type PartitionManagerService struct {
	db         *pgxpool.Pool
	archiver   *storage.S3Archiver
	cron       *cron.Cron
	retention  time.Duration // Operational retention window (default: 24 months)
	preCreate  int           // Number of months to pre-create (default: 2)
}

// PartitionManagerConfig holds configuration for the partition manager
type PartitionManagerConfig struct {
	DB              *pgxpool.Pool
	Archiver        *storage.S3Archiver
	RetentionMonths int    // How many months to keep in operational DB (default: 24)
	PreCreateMonths int    // How many months ahead to pre-create (default: 2)
	Schedule        string // Cron schedule (default: "0 0 1 * *" - 1st of month at midnight)
}

// NewPartitionManagerService creates a new partition manager service
func NewPartitionManagerService(config PartitionManagerConfig) *PartitionManagerService {
	if config.RetentionMonths == 0 {
		config.RetentionMonths = 24
	}
	if config.PreCreateMonths == 0 {
		config.PreCreateMonths = 2
	}

	return &PartitionManagerService{
		db:         config.DB,
		archiver:   config.Archiver,
		cron:       cron.New(),
		retention:  time.Duration(config.RetentionMonths) * 30 * 24 * time.Hour,
		preCreate:  config.PreCreateMonths,
	}
}

// Start begins the partition management worker
func (s *PartitionManagerService) Start(ctx context.Context) error {
	log.Printf("[PartitionManager] Starting partition lifecycle manager")
	log.Printf("[PartitionManager] Retention: %d months, Pre-create: %d months ahead",
		int(s.retention.Hours()/24/30), s.preCreate)

	// Add cron job: 1st of month at midnight UTC
	_, err := s.cron.AddFunc("0 0 1 * *", func() {
		s.runMaintenanceCycle(ctx)
	})
	if err != nil {
		return fmt.Errorf("failed to add cron job: %w", err)
	}

	// Run initial check immediately
	go s.runMaintenanceCycle(ctx)

	// Start cron scheduler
	s.cron.Start()

	log.Printf("[PartitionManager] Partition manager started successfully")
	return nil
}

// Stop gracefully stops the partition manager
func (s *PartitionManagerService) Stop(ctx context.Context) {
	log.Printf("[PartitionManager] Stopping partition manager...")

	stopCtx := s.cron.Stop()
	<-stopCtx.Done()

	log.Printf("[PartitionManager] Partition manager stopped")
}

// runMaintenanceCycle executes the monthly partition maintenance cycle
func (s *PartitionManagerService) runMaintenanceCycle(ctx context.Context) {
	log.Printf("[PartitionManager] Running monthly maintenance cycle...")

	startTime := time.Now()

	// Step 1: Pre-create future partitions
	created, err := s.preCreatePartitions(ctx)
	if err != nil {
		log.Printf("[PartitionManager] ERROR during partition pre-creation: %v", err)
	} else {
		log.Printf("[PartitionManager] Pre-created %d future partitions", created)
	}

	// Step 2: Archive and prune old partitions
	archived, dropped, err := s.archiveAndPruneOldPartitions(ctx)
	if err != nil {
		log.Printf("[PartitionManager] ERROR during archive/prune: %v", err)
	} else {
		log.Printf("[PartitionManager] Archived %d partitions, dropped %d partitions", archived, dropped)
	}

	// Step 3: Verify partition continuity
	gaps, err := s.verifyPartitionContinuity(ctx)
	if err != nil {
		log.Printf("[PartitionManager] ERROR during continuity check: %v", err)
	} else if len(gaps) > 0 {
		log.Printf("[PartitionManager] WARNING: Found %d partition gaps: %v", len(gaps), gaps)
	} else {
		log.Printf("[PartitionManager] Partition continuity verified - no gaps found")
	}

	duration := time.Since(startTime)
	log.Printf("[PartitionManager] Maintenance cycle complete (duration: %v)", duration)
}

// preCreatePartitions creates partitions for future months
func (s *PartitionManagerService) preCreatePartitions(ctx context.Context) (int, error) {
	created := 0

	// Create partitions for the next N months
	for i := 1; i <= s.preCreate; i++ {
		targetDate := time.Now().AddDate(0, i, 0)
		partitionName := fmt.Sprintf("forex_klines_1m_%d_%02d", targetDate.Year(), targetDate.Month())

		// Check if partition already exists
		exists, err := s.partitionExists(ctx, partitionName)
		if err != nil {
			return created, fmt.Errorf("failed to check if partition exists: %w", err)
		}

		if exists {
			log.Printf("[PartitionManager] Partition %s already exists, skipping", partitionName)
			continue
		}

		// Create partition
		err = s.createPartition(ctx, targetDate)
		if err != nil {
			return created, fmt.Errorf("failed to create partition %s: %w", partitionName, err)
		}

		log.Printf("[PartitionManager] Created partition: %s", partitionName)
		created++
	}

	return created, nil
}

// archiveAndPruneOldPartitions archives and drops partitions older than retention period
func (s *PartitionManagerService) archiveAndPruneOldPartitions(ctx context.Context) (int, int, error) {
	archived := 0
	dropped := 0

	// Calculate cutoff date (retention months ago)
	cutoffDate := time.Now().Add(-s.retention)

	// Get list of old partitions
	oldPartitions, err := s.getPartitionsOlderThan(ctx, cutoffDate)
	if err != nil {
		return 0, 0, fmt.Errorf("failed to get old partitions: %w", err)
	}

	if len(oldPartitions) == 0 {
		log.Printf("[PartitionManager] No partitions older than %s found", cutoffDate.Format("2006-01"))
		return 0, 0, nil
	}

	log.Printf("[PartitionManager] Found %d partitions to archive/drop", len(oldPartitions))

	// Process each old partition
	for _, partitionName := range oldPartitions {
		// Check if archiver is configured
		if s.archiver == nil {
			// No archiver configured, just drop the partition directly
			log.Printf("[PartitionManager] No archiver configured, dropping partition without archiving: %s", partitionName)
			err := s.dropPartition(ctx, partitionName)
			if err != nil {
				log.Printf("[PartitionManager] ERROR: Failed to drop partition %s: %v", partitionName, err)
				continue
			}
			log.Printf("[PartitionManager] Successfully dropped partition: %s", partitionName)
			dropped++
			continue
		}

		// Step 1: Archive partition to S3
		log.Printf("[PartitionManager] Archiving partition: %s", partitionName)

		metadata, err := s.archiver.ArchivePartition(ctx, partitionName)
		if err != nil {
			log.Printf("[PartitionManager] ERROR: Failed to archive %s: %v", partitionName, err)
			continue
		}

		// Step 2: Verify archive integrity
		err = s.archiver.VerifyArchive(ctx, metadata)
		if err != nil {
			log.Printf("[PartitionManager] ERROR: Archive verification failed for %s: %v", partitionName, err)
			// Update status to failed
			s.archiver.UpdateArchiveStatus(ctx, partitionName, "failed")
			continue
		}

		// Step 3: Log archive to database
		err = s.archiver.LogArchive(ctx, metadata)
		if err != nil {
			log.Printf("[PartitionManager] ERROR: Failed to log archive for %s: %v", partitionName, err)
			continue
		}

		log.Printf("[PartitionManager] Successfully archived %s (%d rows, %d bytes, checksum: %s)",
			partitionName, metadata.RowCount, metadata.FileSizeBytes, metadata.Checksum[:8])

		archived++

		// Step 4: Drop partition (ONLY after successful archive and verification)
		err = s.dropPartition(ctx, partitionName)
		if err != nil {
			log.Printf("[PartitionManager] ERROR: Failed to drop partition %s: %v", partitionName, err)
			continue
		}

		// Update archive status to dropped
		err = s.archiver.UpdateArchiveStatus(ctx, partitionName, "dropped")
		if err != nil {
			log.Printf("[PartitionManager] WARN: Failed to update archive status for %s: %v", partitionName, err)
		}

		log.Printf("[PartitionManager] Successfully dropped partition: %s", partitionName)
		dropped++
	}

	return archived, dropped, nil
}

// verifyPartitionContinuity checks for gaps in the partition sequence
func (s *PartitionManagerService) verifyPartitionContinuity(ctx context.Context) ([]string, error) {
	gaps := []string{}

	// Get all existing partitions
	partitions, err := s.getAllPartitions(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get partitions: %w", err)
	}

	if len(partitions) == 0 {
		return gaps, nil
	}

	// Parse partition dates and check for gaps
	for i := 1; i < len(partitions); i++ {
		prev := partitions[i-1]
		curr := partitions[i]

		var prevYear, prevMonth, currYear, currMonth int
		fmt.Sscanf(prev, "forex_klines_1m_%d_%d", &prevYear, &prevMonth)
		fmt.Sscanf(curr, "forex_klines_1m_%d_%d", &currYear, &currMonth)

		prevDate := time.Date(prevYear, time.Month(prevMonth), 1, 0, 0, 0, 0, time.UTC)
		currDate := time.Date(currYear, time.Month(currMonth), 1, 0, 0, 0, 0, time.UTC)

		// Check if there's exactly 1 month difference
		expectedNext := prevDate.AddDate(0, 1, 0)
		if !currDate.Equal(expectedNext) {
			gap := fmt.Sprintf("%s to %s", prevDate.Format("2006-01"), currDate.Format("2006-01"))
			gaps = append(gaps, gap)
		}
	}

	return gaps, nil
}

// Helper database operations

func (s *PartitionManagerService) partitionExists(ctx context.Context, partitionName string) (bool, error) {
	query := `
		SELECT EXISTS (
			SELECT 1
			FROM information_schema.tables
			WHERE table_name = $1
		)
	`

	var exists bool
	err := s.db.QueryRow(ctx, query, partitionName).Scan(&exists)
	return exists, err
}

func (s *PartitionManagerService) createPartition(ctx context.Context, targetDate time.Time) error {
	partitionName := fmt.Sprintf("forex_klines_1m_%d_%02d", targetDate.Year(), targetDate.Month())

	startDate := time.Date(targetDate.Year(), targetDate.Month(), 1, 0, 0, 0, 0, time.UTC)
	endDate := startDate.AddDate(0, 1, 0)

	query := fmt.Sprintf(`
		CREATE TABLE %s PARTITION OF forex_klines_1m
		FOR VALUES FROM ('%s') TO ('%s')
	`, partitionName, startDate.Format("2006-01-02 15:04:05"), endDate.Format("2006-01-02 15:04:05"))

	_, err := s.db.Exec(ctx, query)
	return err
}

func (s *PartitionManagerService) dropPartition(ctx context.Context, partitionName string) error {
	query := fmt.Sprintf("DROP TABLE IF EXISTS %s", partitionName)
	_, err := s.db.Exec(ctx, query)
	return err
}

func (s *PartitionManagerService) getPartitionsOlderThan(ctx context.Context, cutoffDate time.Time) ([]string, error) {
	query := `
		SELECT tablename
		FROM pg_tables
		WHERE schemaname = 'public'
		  AND tablename LIKE 'forex_klines_1m_%'
		  AND tablename != 'forex_klines_1m_old'
		ORDER BY tablename
	`

	rows, err := s.db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var oldPartitions []string

	for rows.Next() {
		var partitionName string
		if err := rows.Scan(&partitionName); err != nil {
			return nil, err
		}

		// Parse partition date
		var year, month int
		if _, err := fmt.Sscanf(partitionName, "forex_klines_1m_%d_%d", &year, &month); err != nil {
			continue
		}

		partitionDate := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)

		// Check if partition is older than cutoff
		if partitionDate.Before(cutoffDate) {
			oldPartitions = append(oldPartitions, partitionName)
		}
	}

	return oldPartitions, rows.Err()
}

func (s *PartitionManagerService) getAllPartitions(ctx context.Context) ([]string, error) {
	query := `
		SELECT tablename
		FROM pg_tables
		WHERE schemaname = 'public'
		  AND tablename LIKE 'forex_klines_1m_%'
		  AND tablename != 'forex_klines_1m_old'
		ORDER BY tablename
	`

	rows, err := s.db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var partitions []string
	for rows.Next() {
		var partitionName string
		if err := rows.Scan(&partitionName); err != nil {
			return nil, err
		}
		partitions = append(partitions, partitionName)
	}

	return partitions, rows.Err()
}
