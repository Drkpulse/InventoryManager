/**
 * User Analytics API Controller
 * Handles collection and processing of user behavior analytics
 */

const db = require('../config/db');

// Track user events (clicks, page views, etc.)
exports.trackEvent = async (req, res) => {
  try {
    const {
      session_id,
      event_type,
      page_url,
      page_title,
      element_id,
      element_class,
      element_text,
      time_spent_seconds,
      scroll_depth,
      click_x,
      click_y,
      viewport_width,
      viewport_height,
      metadata = {}
    } = req.body;

    const user_id = req.session?.user?.id || null;
    const ip_address = req.ip || req.connection.remoteAddress;
    const user_agent = req.headers['user-agent'];
    const referrer = req.headers.referer;

    await db.query(`
      INSERT INTO user_analytics_events (
        session_id, user_id, event_type, page_url, page_title,
        element_id, element_class, element_text, time_spent_seconds,
        scroll_depth, click_x, click_y, viewport_width, viewport_height,
        ip_address, user_agent, referrer, metadata, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
    `, [
      session_id, user_id, event_type, page_url, page_title,
      element_id, element_class, element_text, time_spent_seconds,
      scroll_depth, click_x, click_y, viewport_width, viewport_height,
      ip_address, user_agent, referrer, JSON.stringify(metadata), new Date()
    ]);

    // Update session summary
    await updateSessionSummary(session_id, user_id, {
      last_activity: new Date(),
      pages_visited: event_type === 'page_view' ? 1 : 0,
      total_clicks: event_type === 'click' ? 1 : 0,
      scroll_depth: scroll_depth || 0
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error tracking event:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Track page performance metrics
exports.trackPerformance = async (req, res) => {
  try {
    const {
      session_id,
      page_url,
      page_title,
      load_time_ms,
      dom_ready_time_ms,
      first_contentful_paint_ms,
      largest_contentful_paint_ms,
      cumulative_layout_shift,
      first_input_delay_ms,
      interaction_to_next_paint_ms,
      memory_used_mb,
      connection_type,
      device_type,
      browser,
      browser_version,
      os,
      screen_resolution,
      viewport_width,
      viewport_height
    } = req.body;

    const user_id = req.session?.user?.id || null;

    await db.query(`
      INSERT INTO page_performance_metrics (
        session_id, user_id, page_url, page_title, load_time_ms,
        dom_ready_time_ms, first_contentful_paint_ms, largest_contentful_paint_ms,
        cumulative_layout_shift, first_input_delay_ms, interaction_to_next_paint_ms,
        memory_used_mb, connection_type, device_type, browser, browser_version,
        os, screen_resolution, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
    `, [
      session_id, user_id, page_url, page_title, load_time_ms,
      dom_ready_time_ms, first_contentful_paint_ms, largest_contentful_paint_ms,
      cumulative_layout_shift, first_input_delay_ms, interaction_to_next_paint_ms,
      memory_used_mb, connection_type, device_type, browser, browser_version,
      os, screen_resolution, new Date()
    ]);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error tracking performance:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Track cookie consent decisions
exports.trackCookieConsent = async (req, res) => {
  try {
    const {
      session_id,
      consent_type,
      performance_cookies,
      preference_cookies,
      analytics_cookies,
      marketing_cookies,
      consent_method,
      time_to_consent_seconds
    } = req.body;

    const user_id = req.session?.user?.id || null;
    const ip_address = req.ip || req.connection.remoteAddress;
    const user_agent = req.headers['user-agent'];

    await db.query(`
      INSERT INTO cookie_consent_analytics (
        session_id, user_id, consent_type, performance_cookies,
        preference_cookies, analytics_cookies, marketing_cookies,
        consent_method, time_to_consent_seconds, ip_address, user_agent, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      session_id, user_id, consent_type, performance_cookies,
      preference_cookies, analytics_cookies, marketing_cookies,
      consent_method, time_to_consent_seconds, ip_address, user_agent, new Date()
    ]);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error tracking cookie consent:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Handle session end data
exports.trackSessionEnd = async (req, res) => {
  try {
    const {
      session_id,
      total_duration_seconds,
      pages_visited,
      total_clicks,
      final_scroll_depth,
      exit_page,
      click_heatmap
    } = req.body;

    const user_id = req.session?.user?.id || null;

    // Update session summary with final data
    await db.query(`
      UPDATE user_session_summary 
      SET 
        end_time = $1,
        total_duration_seconds = $2,
        pages_visited = GREATEST(pages_visited, $3),
        total_clicks = GREATEST(total_clicks, $4),
        total_scroll_depth = GREATEST(total_scroll_depth, $5),
        exit_page = $6,
        bounce_rate = ($2 < 30 AND $3 <= 1),
        last_activity = $1
      WHERE session_id = $7
    `, [
      new Date(), total_duration_seconds, pages_visited, 
      total_clicks, final_scroll_depth, exit_page, session_id
    ]);

    // Store click heatmap data if provided
    if (click_heatmap && click_heatmap.length > 0) {
      await db.query(`
        INSERT INTO user_analytics_events (
          session_id, user_id, event_type, metadata, timestamp
        ) VALUES ($1, $2, 'session_heatmap', $3, $4)
      `, [session_id, user_id, JSON.stringify({ click_heatmap }), new Date()]);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error tracking session end:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get comprehensive analytics data for admin dashboard
exports.getAnalytics = async (req, res) => {
  try {
    const { period = 'today', detailed = false } = req.query;
    
    let dateFilter = "DATE(timestamp) = CURRENT_DATE";
    if (period === 'week') dateFilter = "timestamp >= CURRENT_DATE - INTERVAL '7 days'";
    if (period === 'month') dateFilter = "timestamp >= CURRENT_DATE - INTERVAL '30 days'";

    // Real-time metrics
    const [
      activeSessionsResult,
      pageViewsResult,
      uniqueVisitorsResult,
      avgSessionDurationResult,
      bounceRateResult,
      topPagesResult,
      deviceStatsResult,
      browserStatsResult,
      performanceStatsResult,
      clickHeatmapResult,
      conversionRateResult
    ] = await Promise.all([
      // Active sessions (last 30 minutes)
      db.query(`
        SELECT COUNT(DISTINCT session_id) as count
        FROM user_session_summary 
        WHERE last_activity > NOW() - INTERVAL '30 minutes'
      `),
      
      // Page views
      db.query(`
        SELECT COUNT(*) as count
        FROM user_analytics_events 
        WHERE event_type = 'page_view' AND ${dateFilter}
      `),
      
      // Unique visitors
      db.query(`
        SELECT COUNT(DISTINCT COALESCE(user_id::text, session_id)) as count
        FROM user_analytics_events 
        WHERE ${dateFilter}
      `),
      
      // Average session duration
      db.query(`
        SELECT AVG(total_duration_seconds) as avg_duration
        FROM user_session_summary 
        WHERE ${dateFilter.replace('timestamp', 'start_time')} AND end_time IS NOT NULL
      `),
      
      // Bounce rate
      db.query(`
        SELECT 
          COUNT(CASE WHEN bounce_rate THEN 1 END)::FLOAT / NULLIF(COUNT(*), 0) * 100 as bounce_rate
        FROM user_session_summary 
        WHERE ${dateFilter.replace('timestamp', 'start_time')}
      `),
      
      // Top pages
      db.query(`
        SELECT 
          page_url,
          page_title,
          COUNT(*) as views,
          COUNT(DISTINCT session_id) as unique_visitors,
          AVG(time_spent_seconds) as avg_time_spent
        FROM user_analytics_events 
        WHERE event_type = 'page_view' AND ${dateFilter}
        GROUP BY page_url, page_title
        ORDER BY views DESC
        LIMIT 10
      `),
      
      // Device statistics
      db.query(`
        SELECT 
          device_type,
          COUNT(DISTINCT session_id) as sessions,
          COUNT(*) as page_views
        FROM user_session_summary uss
        JOIN user_analytics_events uae ON uss.session_id = uae.session_id
        WHERE ${dateFilter.replace('timestamp', 'uae.timestamp')}
        GROUP BY device_type
        ORDER BY sessions DESC
      `),
      
      // Browser statistics
      db.query(`
        SELECT 
          browser,
          COUNT(DISTINCT session_id) as sessions
        FROM user_session_summary 
        WHERE ${dateFilter.replace('timestamp', 'start_time')}
        GROUP BY browser
        ORDER BY sessions DESC
        LIMIT 5
      `),
      
      // Performance statistics
      db.query(`
        SELECT 
          AVG(load_time_ms) as avg_load_time,
          AVG(first_contentful_paint_ms) as avg_fcp,
          AVG(largest_contentful_paint_ms) as avg_lcp,
          AVG(memory_used_mb) as avg_memory_usage,
          COUNT(*) as total_measurements
        FROM page_performance_metrics 
        WHERE ${dateFilter}
      `),
      
      // Click heatmap data (if detailed)
      detailed ? db.query(`
        SELECT 
          click_x, click_y, page_url,
          COUNT(*) as click_count
        FROM user_analytics_events 
        WHERE event_type = 'click' AND ${dateFilter} 
          AND click_x IS NOT NULL AND click_y IS NOT NULL
        GROUP BY click_x, click_y, page_url
        HAVING COUNT(*) > 1
        ORDER BY click_count DESC
        LIMIT 1000
      `) : Promise.resolve({ rows: [] }),
      
      // Conversion rate
      db.query(`
        SELECT 
          COUNT(CASE WHEN event_type = 'conversion' THEN 1 END)::FLOAT / 
          NULLIF(COUNT(DISTINCT session_id), 0) * 100 as conversion_rate
        FROM user_analytics_events 
        WHERE ${dateFilter}
      `)
    ]);

    // Cookie consent statistics
    const cookieConsentResult = await db.query(`
      SELECT 
        consent_type,
        COUNT(*) as count,
        AVG(time_to_consent_seconds) as avg_decision_time
      FROM cookie_consent_analytics 
      WHERE ${dateFilter}
      GROUP BY consent_type
      ORDER BY count DESC
    `);

    // Most clicked elements
    const clickAnalyticsResult = await db.query(`
      SELECT 
        element_id,
        element_class,
        element_text,
        COUNT(*) as click_count,
        COUNT(DISTINCT session_id) as unique_clickers
      FROM user_analytics_events 
      WHERE event_type = 'click' AND ${dateFilter}
        AND (element_id IS NOT NULL OR element_class IS NOT NULL)
      GROUP BY element_id, element_class, element_text
      ORDER BY click_count DESC
      LIMIT 20
    `);

    const analytics = {
      realtime: {
        activeSessions: activeSessionsResult.rows[0]?.count || 0,
        pageViews: pageViewsResult.rows[0]?.count || 0,
        uniqueVisitors: uniqueVisitorsResult.rows[0]?.count || 0
      },
      engagement: {
        avgSessionDuration: Math.round(avgSessionDurationResult.rows[0]?.avg_duration || 0),
        bounceRate: Math.round(bounceRateResult.rows[0]?.bounce_rate || 0),
        conversionRate: parseFloat(conversionRateResult.rows[0]?.conversion_rate || 0).toFixed(2)
      },
      performance: {
        avgLoadTime: Math.round(performanceStatsResult.rows[0]?.avg_load_time || 0),
        avgFcp: Math.round(performanceStatsResult.rows[0]?.avg_fcp || 0),
        avgLcp: Math.round(performanceStatsResult.rows[0]?.avg_lcp || 0),
        avgMemoryUsage: parseFloat(performanceStatsResult.rows[0]?.avg_memory_usage || 0).toFixed(1),
        measurements: performanceStatsResult.rows[0]?.total_measurements || 0
      },
      audience: {
        devices: deviceStatsResult.rows,
        browsers: browserStatsResult.rows
      },
      content: {
        topPages: topPagesResult.rows,
        clickAnalytics: clickAnalyticsResult.rows
      },
      cookies: {
        consent: cookieConsentResult.rows
      }
    };

    if (detailed) {
      analytics.heatmap = clickHeatmapResult.rows;
    }

    res.json({ success: true, analytics, period });
  } catch (error) {
    console.error('Error getting analytics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Helper function to update session summary
async function updateSessionSummary(sessionId, userId, updates) {
  try {
    const existingSession = await db.query(
      'SELECT * FROM user_session_summary WHERE session_id = $1',
      [sessionId]
    );

    if (existingSession.rows.length === 0) {
      // Create new session summary
      await db.query(`
        INSERT INTO user_session_summary (
          session_id, user_id, start_time, pages_visited, total_clicks, 
          total_scroll_depth, last_activity, device_type, is_mobile
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'desktop', false)
        ON CONFLICT (session_id) DO NOTHING
      `, [
        sessionId, userId, new Date(), 
        updates.pages_visited || 0, updates.total_clicks || 0,
        updates.scroll_depth || 0, updates.last_activity || new Date()
      ]);
    } else {
      // Update existing session
      await db.query(`
        UPDATE user_session_summary 
        SET 
          pages_visited = pages_visited + $1,
          total_clicks = total_clicks + $2,
          total_scroll_depth = GREATEST(total_scroll_depth, $3),
          last_activity = $4
        WHERE session_id = $5
      `, [
        updates.pages_visited || 0,
        updates.total_clicks || 0,
        updates.scroll_depth || 0,
        updates.last_activity || new Date(),
        sessionId
      ]);
    }
  } catch (error) {
    console.error('Error updating session summary:', error);
  }
}

module.exports = exports;
