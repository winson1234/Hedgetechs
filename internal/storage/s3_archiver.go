package storage

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/jackc/pgx/v5/pgxpool"
)

// S3Archiver handles archiving partition data to S3-compatible storage
type S3Archiver struct {
	s3Client   *s3.Client
	bucketName string
	db         *pgxpool.Pool
}

// ArchiverConfig holds configuration for the S3 archiver
type ArchiverConfig struct {
	BucketName      string
	Region          string
	Endpoint        string // For S3-compatible services (e.g., Supabase Storage)
	AccessKeyID     string
	SecretAccessKey string
	DB              *pgxpool.Pool
}

// ArchiveMetadata contains metadata about an archived partition
type ArchiveMetadata struct {
	PartitionName string    `json:"partition_name"`
	ArchiveDate   time.Time `json:"archive_date"`
	RowCount      int64     `json:"row_count"`
	FileSizeBytes int64     `json:"file_size_bytes"`
	Checksum      string    `json:"checksum"` // SHA-256 checksum
	S3Key         string    `json:"s3_key"`
	Format        string    `json:"format"` // "csv" or "parquet"
}

// NewS3Archiver creates a new S3 archiver instance
func NewS3Archiver(cfg ArchiverConfig) (*S3Archiver, error) {
	// Load AWS configuration
	var awsConfig aws.Config
	var err error

	if cfg.Endpoint != "" {
		// Use custom endpoint (for Supabase Storage or MinIO)
		awsConfig, err = config.LoadDefaultConfig(context.TODO(),
			config.WithRegion(cfg.Region),
			config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
				cfg.AccessKeyID,
				cfg.SecretAccessKey,
				"",
			)),
			config.WithEndpointResolverWithOptions(aws.EndpointResolverWithOptionsFunc(
				func(service, region string, options ...interface{}) (aws.Endpoint, error) {
					return aws.Endpoint{
						URL:               cfg.Endpoint,
						SigningRegion:     cfg.Region,
						HostnameImmutable: true,
					}, nil
				},
			)),
		)
	} else {
		// Use standard AWS S3
		awsConfig, err = config.LoadDefaultConfig(context.TODO(),
			config.WithRegion(cfg.Region),
			config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
				cfg.AccessKeyID,
				cfg.SecretAccessKey,
				"",
			)),
		)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config: %w", err)
	}

	// Create S3 client
	s3Client := s3.NewFromConfig(awsConfig, func(o *s3.Options) {
		if cfg.Endpoint != "" {
			o.UsePathStyle = true // Required for MinIO and Supabase Storage
		}
	})

	return &S3Archiver{
		s3Client:   s3Client,
		bucketName: cfg.BucketName,
		db:         cfg.DB,
	}, nil
}

// ArchivePartition exports a partition to S3 in CSV format and returns metadata
func (a *S3Archiver) ArchivePartition(ctx context.Context, partitionName string) (*ArchiveMetadata, error) {
	log.Printf("[S3Archiver] Starting archive for partition: %s", partitionName)

	// Step 1: Export partition data to CSV
	csvData, rowCount, err := a.exportPartitionToCSV(ctx, partitionName)
	if err != nil {
		return nil, fmt.Errorf("failed to export partition to CSV: %w", err)
	}

	if rowCount == 0 {
		return nil, fmt.Errorf("partition %s has no rows to archive", partitionName)
	}

	// Step 2: Calculate checksum
	checksum := calculateChecksum(csvData)

	// Step 3: Generate S3 key
	// Format: forex-archive/klines/1m/YYYY/MM/forex_klines_1m_YYYY_MM.csv
	s3Key := generateS3Key(partitionName, "csv")

	// Step 4: Upload to S3
	fileSize, err := a.uploadToS3(ctx, s3Key, csvData)
	if err != nil {
		return nil, fmt.Errorf("failed to upload to S3: %w", err)
	}

	// Step 5: Create metadata
	metadata := &ArchiveMetadata{
		PartitionName: partitionName,
		ArchiveDate:   time.Now(),
		RowCount:      rowCount,
		FileSizeBytes: fileSize,
		Checksum:      checksum,
		S3Key:         s3Key,
		Format:        "csv",
	}

	log.Printf("[S3Archiver] Successfully archived partition %s: %d rows, %d bytes, key=%s",
		partitionName, rowCount, fileSize, s3Key)

	return metadata, nil
}

// exportPartitionToCSV exports partition data to CSV format
func (a *S3Archiver) exportPartitionToCSV(ctx context.Context, partitionName string) ([]byte, int64, error) {
	// Use COPY TO to export partition data to CSV
	query := fmt.Sprintf(`
		COPY (
			SELECT
				symbol,
				timestamp,
				open_bid,
				high_bid,
				low_bid,
				close_bid,
				open_ask,
				high_ask,
				low_ask,
				close_ask,
				volume
			FROM %s
			ORDER BY timestamp
		) TO STDOUT WITH (FORMAT CSV, HEADER)
	`, partitionName)

	// Create buffer to store CSV data
	buf := new(bytes.Buffer)

	// Execute COPY TO query
	conn, err := a.db.Acquire(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to acquire connection: %w", err)
	}
	defer conn.Release()

	// Use CopyTo to export data
	tag, err := conn.Conn().PgConn().CopyTo(ctx, buf, query)
	if err != nil {
		return nil, 0, fmt.Errorf("COPY TO failed: %w", err)
	}

	rowCount := tag.RowsAffected()
	csvData := buf.Bytes()

	log.Printf("[S3Archiver] Exported %d rows from %s (%d bytes)", rowCount, partitionName, len(csvData))

	return csvData, rowCount, nil
}

// uploadToS3 uploads data to S3 and returns the file size
func (a *S3Archiver) uploadToS3(ctx context.Context, key string, data []byte) (int64, error) {
	// Upload to S3
	_, err := a.s3Client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(a.bucketName),
		Key:         aws.String(key),
		Body:        bytes.NewReader(data),
		ContentType: aws.String("text/csv"),
		Metadata: map[string]string{
			"archived-by": "partition-manager-service",
			"archived-at": time.Now().Format(time.RFC3339),
		},
	})

	if err != nil {
		return 0, fmt.Errorf("S3 upload failed: %w", err)
	}

	return int64(len(data)), nil
}

// VerifyArchive verifies that the archived data matches the checksum
func (a *S3Archiver) VerifyArchive(ctx context.Context, metadata *ArchiveMetadata) error {
	// Download file from S3
	result, err := a.s3Client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(a.bucketName),
		Key:    aws.String(metadata.S3Key),
	})
	if err != nil {
		return fmt.Errorf("failed to download from S3: %w", err)
	}
	defer result.Body.Close()

	// Read all data
	buf := new(bytes.Buffer)
	_, err = buf.ReadFrom(result.Body)
	if err != nil {
		return fmt.Errorf("failed to read S3 object: %w", err)
	}

	// Calculate checksum
	downloadedChecksum := calculateChecksum(buf.Bytes())

	// Compare checksums
	if downloadedChecksum != metadata.Checksum {
		return fmt.Errorf("checksum mismatch: expected %s, got %s", metadata.Checksum, downloadedChecksum)
	}

	log.Printf("[S3Archiver] Archive verified successfully: %s (checksum: %s)", metadata.S3Key, downloadedChecksum)

	return nil
}

// LogArchive logs the archive operation to the database
func (a *S3Archiver) LogArchive(ctx context.Context, metadata *ArchiveMetadata) error {
	query := `
		INSERT INTO partition_archive_log (
			partition_name,
			archive_date,
			archive_location,
			row_count,
			file_size_bytes,
			checksum,
			status
		) VALUES ($1, $2, $3, $4, $5, $6, $7)
	`

	archiveLocation := fmt.Sprintf("s3://%s/%s", a.bucketName, metadata.S3Key)

	_, err := a.db.Exec(ctx, query,
		metadata.PartitionName,
		metadata.ArchiveDate,
		archiveLocation,
		metadata.RowCount,
		metadata.FileSizeBytes,
		metadata.Checksum,
		"archived",
	)

	if err != nil {
		return fmt.Errorf("failed to log archive: %w", err)
	}

	return nil
}

// UpdateArchiveStatus updates the status of an archive log entry
func (a *S3Archiver) UpdateArchiveStatus(ctx context.Context, partitionName, status string) error {
	query := `
		UPDATE partition_archive_log
		SET status = $1
		WHERE partition_name = $2
	`

	_, err := a.db.Exec(ctx, query, status, partitionName)
	if err != nil {
		return fmt.Errorf("failed to update archive status: %w", err)
	}

	return nil
}

// Helper functions

// calculateChecksum calculates SHA-256 checksum of data
func calculateChecksum(data []byte) string {
	hash := sha256.Sum256(data)
	return hex.EncodeToString(hash[:])
}

// generateS3Key generates S3 key for partition archive
// Format: forex-archive/klines/1m/YYYY/MM/forex_klines_1m_YYYY_MM.csv
func generateS3Key(partitionName, format string) string {
	// Parse partition name (e.g., forex_klines_1m_2025_11)
	// Extract year and month
	var year, month string
	fmt.Sscanf(partitionName, "forex_klines_1m_%s_%s", &year, &month)

	return fmt.Sprintf("forex-archive/klines/1m/%s/%s/%s.%s", year, month, partitionName, format)
}

// ExportMetadataToJSON exports metadata to JSON for auditing
func (m *ArchiveMetadata) ToJSON() (string, error) {
	data, err := json.MarshalIndent(m, "", "  ")
	if err != nil {
		return "", err
	}
	return string(data), nil
}
