import React, { useEffect, useState } from 'react'

type NewsArticle = {
  title: string
  link: string
  description: string
  pubDate: string
  source: string
  guid?: string
}

type NewsResponse = {
  articles: NewsArticle[]
  count: number
}

type FilterType = 'all' | 'crypto' | 'forex' | 'market' | 'system'

export default function NewsPanel() {
  const [articles, setArticles] = useState<NewsArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterType>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null)
  const [readArticles, setReadArticles] = useState<Set<string>>(new Set())
  const [lastFetchTime, setLastFetchTime] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState(0)

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const response = await fetch('/api/v1/news')
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const data: NewsResponse = await response.json()
        
        // Mark new articles as unread (if this is not the first fetch)
        if (lastFetchTime > 0) {
          // Articles published after last fetch are considered new
          data.articles.forEach(article => {
            const articleTime = new Date(article.pubDate).getTime()
            if (articleTime > lastFetchTime) {
              // These are new articles, don't add to readArticles
            }
          })
        } else {
          // First load - mark all as read after 2 seconds
          setTimeout(() => {
            const allGuids = new Set(data.articles.map(a => a.guid || a.link))
            setReadArticles(allGuids)
          }, 2000)
        }
        
        setArticles(data.articles)
        setLastFetchTime(Date.now())
        setLoading(false)
      } catch (err) {
        console.error('Failed to fetch news:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch news')
        setLoading(false)
      }
    }

    fetchNews()
    // Refresh news every 5 minutes
    const interval = setInterval(fetchNews, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [lastFetchTime])

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const truncateHeadline = (text: string, maxLength: number = 80) => {
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength).trim() + '...'
  }

  const handleArticleClick = (article: NewsArticle) => {
    setSelectedArticle(article)
    // Mark as read
    setReadArticles(prev => new Set([...prev, article.guid || article.link]))
  }

  const closeModal = () => {
    setSelectedArticle(null)
  }

  const isUnread = (article: NewsArticle) => {
    return !readArticles.has(article.guid || article.link)
  }

  // Define crypto and forex sources
  const cryptoSources = ['CoinDesk', 'CryptoNews', 'CoinTelegraph']
  const forexSources = ['FXStreet', 'Investing.com', 'Yahoo Finance']

  // Filter articles based on selected filter and search query
  const filteredArticles = articles.filter(article => {
    // First, apply search filter if search query exists
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      const titleLower = article.title.toLowerCase()
      const descLower = article.description.toLowerCase()
      const matchesSearch = titleLower.includes(query) || descLower.includes(query)
      if (!matchesSearch) return false
    }

    // Then apply category filter
    if (filter === 'all') return true
    
    if (filter === 'crypto') {
      return cryptoSources.includes(article.source)
    } else if (filter === 'forex') {
      return forexSources.includes(article.source)
    }
    
    // Simple categorization based on keywords for market/system filters
    const titleLower = article.title.toLowerCase()
    const descLower = article.description.toLowerCase()
    const content = titleLower + ' ' + descLower
    
    if (filter === 'market') {
      // Market news: mentions of price, trading, market, stocks, crypto, bitcoin, ethereum, etc.
      return /\b(price|trading|market|stock|crypto|bitcoin|ethereum|btc|eth|rally|surge|drop|climb|fall)\b/i.test(content)
    } else if (filter === 'system') {
      // System alerts: mentions of regulation, security, hack, breach, warning, alert, etc.
      return /\b(alert|warning|regulation|security|hack|breach|scam|fraud|sec|fda|government)\b/i.test(content)
    }
    return true
  })

  const unreadCount = filteredArticles.filter(isUnread).length

  // Pagination: always show exactly 3 items per page
  const itemsPerPage = 3
  const totalPages = Math.ceil(filteredArticles.length / itemsPerPage)
  const startIndex = currentPage * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const displayedArticles = filteredArticles.slice(startIndex, endIndex)

  // Reset to first page when filter or search changes
  React.useEffect(() => {
    setCurrentPage(0)
  }, [filter, searchQuery])

  const goToNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1)
    }
  }

  const goToPreviousPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header with title and unread count */}
      <div className="flex items-center gap-2 mb-3">
        <div className="text-xl font-bold text-slate-900 dark:text-slate-100">News</div>
        {unreadCount > 0 && (
          <span className="px-2 py-0.5 text-xs font-semibold bg-indigo-500 text-white rounded-full">
            {unreadCount}
          </span>
        )}
      </div>

      {/* Search Bar */}
      <div className="relative mb-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search news..."
          className="w-full px-3 py-2 pl-9 pr-9 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 transition"
        />
        {/* Search Icon */}
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        {/* Clear Button */}
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
        
      {/* Filter Toggle */}
      <div className="flex justify-between gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 mb-3">
        <button
          onClick={() => setFilter('all')}
          className={`flex-1 px-3 py-1 text-xs font-medium rounded transition-colors ${
            filter === 'all'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('crypto')}
          className={`flex-1 px-3 py-1 text-xs font-medium rounded transition-colors ${
            filter === 'crypto'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          Crypto
        </button>
        <button
          onClick={() => setFilter('forex')}
          className={`flex-1 px-3 py-1 text-xs font-medium rounded transition-colors ${
            filter === 'forex'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          Forex
        </button>
        <button
          onClick={() => setFilter('market')}
          className={`flex-1 px-3 py-1 text-xs font-medium rounded transition-colors ${
            filter === 'market'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          Market
        </button>
        <button
          onClick={() => setFilter('system')}
          className={`flex-1 px-3 py-1 text-xs font-medium rounded transition-colors ${
            filter === 'system'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          Alerts
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Loading news...
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="text-sm text-red-500 dark:text-red-400">
          Error: {error}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredArticles.length === 0 && (
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {searchQuery 
            ? `No results found for "${searchQuery}"` 
            : `No ${filter !== 'all' ? filter : ''} news available`
          }
        </div>
      )}

      {/* Compact News List */}
      {!loading && !error && filteredArticles.length > 0 && (
        <>
          <div className="space-y-2 flex-1">
            {displayedArticles.map((article, index) => {
              const unread = isUnread(article)
              return (
                <div
                  key={article.guid || index}
                  onClick={() => handleArticleClick(article)}
                  className="group relative border border-slate-200 dark:border-slate-700 rounded-lg p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                >
                  {/* Unread indicator */}
                  {unread && (
                    <div className="absolute top-3 right-3">
                      <span className="flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                      </span>
                    </div>
                  )}
                  
                  {/* Headline */}
                  <h3 className={`text-sm font-semibold pr-4 mb-1.5 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors ${
                    unread ? 'text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300'
                  }`}>
                    {truncateHeadline(article.title)}
                  </h3>
                  
                  {/* Source and Timestamp */}
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-500">
                    <span className="font-medium px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
                      {article.source}
                    </span>
                    <span>{formatTimeAgo(article.pubDate)}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={goToPreviousPage}
                disabled={currentPage === 0}
                className={`px-3 py-1.5 text-xs font-medium rounded transition ${
                  currentPage === 0
                    ? 'text-slate-400 dark:text-slate-600 cursor-not-allowed'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                ← Previous
              </button>
              
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {currentPage + 1} / {totalPages}
              </span>
              
              <button
                onClick={goToNextPage}
                disabled={currentPage === totalPages - 1}
                className={`px-3 py-1.5 text-xs font-medium rounded transition ${
                  currentPage === totalPages - 1
                    ? 'text-slate-400 dark:text-slate-600 cursor-not-allowed'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal/Drawer for Article Details */}
      {selectedArticle && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="border-b border-slate-200 dark:border-slate-700 p-4 flex items-start justify-between">
              <div className="flex-1 pr-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded">
                    {selectedArticle.source}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {formatTimeAgo(selectedArticle.pubDate)}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  {selectedArticle.title}
                </h2>
              </div>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-6">
                {selectedArticle.description}
              </p>
              
              <a
                href={selectedArticle.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
              >
                Read Full Article
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

