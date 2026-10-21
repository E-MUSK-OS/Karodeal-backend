import { prisma } from '../utils/db.js';
import { emitAnalyticsChange } from '../utils/socket.js';
import { parseTrafficSource } from '../utils/trafficSource.js';

// Simple lightweight User-Agent Parser
function parseUserAgent(ua = '') {
  if (!ua) return { deviceType: 'Desktop', browser: 'Unknown', os: 'Unknown' };

  let deviceType = 'Desktop';
  if (/mobile/i.test(ua)) deviceType = 'Mobile';
  else if (/tablet|ipad/i.test(ua)) deviceType = 'Tablet';

  let browser = 'Unknown';
  if (/edg/i.test(ua)) browser = 'Edge';
  else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
  else if (/opr\//i.test(ua)) browser = 'Opera';

  let os = 'Unknown';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  return { deviceType, browser, os };
}

// Basic UUID validation to prevent injection or invalid IDs
const isValidId = (id) => typeof id === 'string' && id.trim().length >= 8 && id.trim().length <= 64;

// 1. Record / Initialize Session
export const recordSession = async (req, res) => {
  try {
    const { visitorId, sessionId, userAgent: clientUa, referrer, queryParams } = req.body || {};

    if (!isValidId(visitorId) || !isValidId(sessionId)) {
      return res.status(400).json({ error: 'Invalid visitorId or sessionId' });
    }

    const rawUa = clientUa || req.headers['user-agent'] || '';
    const { deviceType, browser, os } = parseUserAgent(rawUa);
    const ipAddress = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    const traffic = parseTrafficSource(referrer, queryParams, rawUa);

    // Check if visitor already exists
    const existingVisitor = await prisma.analyticsVisitor.findUnique({
      where: { id: visitorId },
      select: { id: true, totalVisits: true, firstTrafficSource: true, firstTrafficMedium: true }
    });

    // Check if session already exists
    const existingSession = await prisma.analyticsSession.findUnique({
      where: { id: sessionId },
      select: { id: true }
    });

    const isNewSession = !existingSession;

    // Upsert Visitor
    await prisma.analyticsVisitor.upsert({
      where: { id: visitorId },
      create: {
        id: visitorId,
        deviceType,
        browser,
        os,
        ipAddress: ipAddress ? ipAddress.slice(0, 45) : null,
        totalVisits: 1,
        firstVisitAt: new Date(),
        lastVisitAt: new Date(),
        firstTrafficSource: traffic.source,
        firstTrafficMedium: traffic.medium
      },
      update: {
        lastVisitAt: new Date(),
        totalVisits: isNewSession ? { increment: 1 } : undefined,
        deviceType,
        browser,
        os,
        ipAddress: ipAddress ? ipAddress.slice(0, 45) : undefined,
        firstTrafficSource: (traffic.source !== 'Direct / Chrome Search')
          ? traffic.source
          : (existingVisitor?.firstTrafficSource || 'Direct / Chrome Search'),
        firstTrafficMedium: (traffic.source !== 'Direct / Chrome Search')
          ? traffic.medium
          : (existingVisitor?.firstTrafficMedium || 'direct')
      }
    });

    // Upsert Session
    await prisma.analyticsSession.upsert({
      where: { id: sessionId },
      create: {
        id: sessionId,
        visitorId,
        startedAt: new Date(),
        lastActivityAt: new Date(),
        isLive: true,
        userAgent: rawUa ? rawUa.slice(0, 500) : null,
        referrer: referrer ? String(referrer).slice(0, 500) : null,
        trafficSource: traffic.source,
        trafficMedium: traffic.medium,
        utmCampaign: traffic.campaign ? traffic.campaign.slice(0, 150) : null
      },
      update: {
        lastActivityAt: new Date(),
        isLive: true,
        trafficSource: (traffic.source !== 'Direct / Chrome Search') ? traffic.source : undefined,
        trafficMedium: (traffic.source !== 'Direct / Chrome Search') ? traffic.medium : undefined,
        utmCampaign: traffic.campaign ? traffic.campaign.slice(0, 150) : undefined
      }
    });

    // Emit Realtime Socket Event
    emitAnalyticsChange('session_started', { visitorId, sessionId });

    return res.json({ success: true, visitorId, sessionId });
  } catch (error) {
    console.error('Error in recordSession:', error);
    return res.status(500).json({ error: 'Failed to record session' });
  }
};

// 2. Record Page Enter
export const recordPageEnter = async (req, res) => {
  try {
    const { visitorId, sessionId, pageVisitId, pagePath, pageTitle, referrer, queryParams } = req.body || {};

    if (!isValidId(visitorId) || !isValidId(sessionId) || !isValidId(pageVisitId)) {
      return res.status(400).json({ error: 'Invalid tracking IDs provided' });
    }

    const safePath = (pagePath && typeof pagePath === 'string') ? pagePath.slice(0, 500) : '/';
    const safeTitle = (pageTitle && typeof pageTitle === 'string') ? pageTitle.slice(0, 300) : null;
    const safeReferrer = (referrer && typeof referrer === 'string') ? referrer.slice(0, 500) : null;
    const rawUa = req.headers['user-agent'] || '';
    const traffic = parseTrafficSource(referrer, queryParams, rawUa);

    const now = new Date();

    // Ensure visitor & session exist before creating page visit
    await prisma.analyticsVisitor.upsert({
      where: { id: visitorId },
      create: {
        id: visitorId,
        firstVisitAt: now,
        lastVisitAt: now,
        firstTrafficSource: traffic.source,
        firstTrafficMedium: traffic.medium
      },
      update: {
        lastVisitAt: now,
        firstTrafficSource: (traffic.source !== 'Direct / Chrome Search') ? traffic.source : undefined,
        firstTrafficMedium: (traffic.source !== 'Direct / Chrome Search') ? traffic.medium : undefined
      }
    });

    await prisma.analyticsSession.upsert({
      where: { id: sessionId },
      create: {
        id: sessionId,
        visitorId,
        startedAt: now,
        lastActivityAt: now,
        isLive: true,
        referrer: safeReferrer,
        trafficSource: traffic.source,
        trafficMedium: traffic.medium,
        utmCampaign: traffic.campaign ? traffic.campaign.slice(0, 150) : null
      },
      update: {
        lastActivityAt: now,
        isLive: true,
        pageCount: { increment: 1 },
        trafficSource: (traffic.source !== 'Direct / Chrome Search') ? traffic.source : undefined,
        trafficMedium: (traffic.source !== 'Direct / Chrome Search') ? traffic.medium : undefined,
        utmCampaign: traffic.campaign ? traffic.campaign.slice(0, 150) : undefined
      }
    });

    // Create or re-initialize page visit record
    const visit = await prisma.analyticsPageVisit.upsert({
      where: { id: pageVisitId },
      create: {
        id: pageVisitId,
        visitorId,
        sessionId,
        pagePath: safePath,
        pageTitle: safeTitle,
        referrer: safeReferrer,
        enteredAt: now,
        lastActivityAt: now,
        durationSeconds: 0,
        activeSeconds: 0,
        status: 'ACTIVE'
      },
      update: {
        pagePath: safePath,
        pageTitle: safeTitle,
        lastActivityAt: now,
        status: 'ACTIVE'
      }
    });

    // Emit Realtime Socket Event
    emitAnalyticsChange('page_enter', { visitorId, sessionId, pageVisitId: visit.id, pagePath: safePath });

    return res.json({ success: true, pageVisitId: visit.id });
  } catch (error) {
    console.error('Error in recordPageEnter:', error);
    return res.status(500).json({ error: 'Failed to record page enter' });
  }
};

// 3. Record Heartbeat
export const recordHeartbeat = async (req, res) => {
  try {
    const { visitorId, sessionId, pageVisitId, activeSecondsDelta, elapsedSeconds, isActive } = req.body || {};

    if (!isValidId(visitorId) || !isValidId(sessionId) || !isValidId(pageVisitId)) {
      return res.status(400).json({ error: 'Invalid tracking IDs' });
    }

    // Verify ownership and prevent ID spoofing
    const visit = await prisma.analyticsPageVisit.findUnique({
      where: { id: pageVisitId },
      select: { id: true, visitorId: true, sessionId: true, activeSeconds: true, durationSeconds: true }
    });

    if (!visit) {
      return res.status(404).json({ error: 'Page visit record not found' });
    }

    if (visit.visitorId !== visitorId || visit.sessionId !== sessionId) {
      return res.status(403).json({ error: 'Forbidden: ID ownership mismatch' });
    }

    // Bound values to prevent malicious manipulation (heartbeats occur every 15s)
    const delta = Math.min(Math.max(Number(activeSecondsDelta) || 0, 0), 60);
    const safeElapsed = Math.min(Math.max(Number(elapsedSeconds) || 0, 0), 86400);
    const newActiveSeconds = Math.round(visit.activeSeconds + delta);
    const newDurationSeconds = Math.round(Math.max(visit.durationSeconds, safeElapsed));
    const newStatus = isActive ? 'ACTIVE' : 'INACTIVE';
    const now = new Date();

    await prisma.analyticsPageVisit.update({
      where: { id: pageVisitId },
      data: {
        lastActivityAt: now,
        activeSeconds: newActiveSeconds,
        durationSeconds: newDurationSeconds,
        status: newStatus
      }
    });

    // Update Session
    await prisma.analyticsSession.update({
      where: { id: sessionId },
      data: {
        lastActivityAt: now,
        isLive: true,
        activeSeconds: { increment: Math.round(delta) },
        durationSeconds: newDurationSeconds
      }
    });

    // Update Visitor
    if (delta > 0) {
      await prisma.analyticsVisitor.update({
        where: { id: visitorId },
        data: {
          lastVisitAt: now,
          totalActiveSeconds: { increment: Math.round(delta) }
        }
      });
    }

    // Emit Realtime Socket Event
    emitAnalyticsChange('heartbeat', { visitorId, sessionId, pageVisitId, status: newStatus });

    return res.json({ success: true });
  } catch (error) {
    console.error('Error in recordHeartbeat:', error);
    return res.status(500).json({ error: 'Failed to record heartbeat' });
  }
};

// 4. Record Page Exit (Supports beacon/fetch)
export const recordPageExit = async (req, res) => {
  try {
    let payload = req.body;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch (e) {
        payload = {};
      }
    }

    const { visitorId, sessionId, pageVisitId, activeSecondsDelta, elapsedSeconds } = payload || {};

    if (!isValidId(visitorId) || !isValidId(sessionId) || !isValidId(pageVisitId)) {
      return res.status(400).json({ error: 'Invalid tracking IDs' });
    }

    const visit = await prisma.analyticsPageVisit.findUnique({
      where: { id: pageVisitId },
      select: { id: true, visitorId: true, sessionId: true, activeSeconds: true, durationSeconds: true }
    });

    if (!visit) {
      return res.status(404).json({ error: 'Page visit record not found' });
    }

    if (visit.visitorId !== visitorId || visit.sessionId !== sessionId) {
      return res.status(403).json({ error: 'Forbidden: ID ownership mismatch' });
    }

    const delta = Math.min(Math.max(Number(activeSecondsDelta) || 0, 0), 60);
    const safeElapsed = Math.min(Math.max(Number(elapsedSeconds) || 0, 0), 86400);
    let finalActiveSeconds = Math.round(visit.activeSeconds + delta);
    const finalDurationSeconds = Math.round(Math.max(visit.durationSeconds, safeElapsed));
    let effectiveDelta = Math.round(delta);

    // If visit had elapsed duration >= 1 but activeSeconds is still 0, ensure at least 1s
    if (finalActiveSeconds === 0 && finalDurationSeconds >= 1) {
      finalActiveSeconds = 1;
      effectiveDelta = Math.max(effectiveDelta, 1);
    }
    const now = new Date();

    await prisma.analyticsPageVisit.update({
      where: { id: pageVisitId },
      data: {
        leftAt: now,
        lastActivityAt: now,
        activeSeconds: finalActiveSeconds,
        durationSeconds: finalDurationSeconds,
        status: 'ENDED'
      }
    });

    await prisma.analyticsSession.update({
      where: { id: sessionId },
      data: {
        lastActivityAt: now,
        activeSeconds: { increment: effectiveDelta },
        durationSeconds: finalDurationSeconds
      }
    });

    if (effectiveDelta > 0) {
      await prisma.analyticsVisitor.update({
        where: { id: visitorId },
        data: {
          lastVisitAt: now,
          totalActiveSeconds: { increment: effectiveDelta }
        }
      });
    }

    // Emit Realtime Socket Event
    emitAnalyticsChange('page_exit', { visitorId, sessionId, pageVisitId });

    return res.json({ success: true });
  } catch (error) {
    console.error('Error in recordPageExit:', error);
    return res.status(500).json({ error: 'Failed to record page exit' });
  }
};

// 5. Main Admin: Get Visitors List with Search, Filters, Live Status, and Summary
export const getAnalyticsVisitors = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const { search, status, pagePath, startDate, endDate, tab, source } = req.query;

    const now = new Date();
    // A visitor is considered currently LIVE if they had confirmed activity within the last 90 seconds
    const LIVE_THRESHOLD_MS = 90 * 1000;
    const liveCutoff = new Date(now.getTime() - LIVE_THRESHOLD_MS);

    // Build filter conditions
    const where = {};

    if (search && search.trim()) {
      where.OR = [
        { id: { contains: search.trim(), mode: 'insensitive' } },
        { pageVisits: { some: { pagePath: { contains: search.trim(), mode: 'insensitive' } } } }
      ];
    }

    if (source && source !== 'ALL') {
      if (source === 'ADS') {
        where.OR = [
          { firstTrafficMedium: { in: ['cpc', 'paid_social', 'ads', 'ppc'] } },
          { sessions: { some: { trafficMedium: { in: ['cpc', 'paid_social', 'ads', 'ppc'] } } } }
        ];
      } else if (source === 'SEARCH') {
        where.OR = [
          { firstTrafficSource: { contains: 'Search', mode: 'insensitive' } },
          { sessions: { some: { trafficSource: { contains: 'Search', mode: 'insensitive' } } } }
        ];
      } else if (source === 'SOCIAL') {
        where.OR = [
          { firstTrafficMedium: 'social' },
          { sessions: { some: { trafficMedium: 'social' } } }
        ];
      } else if (source === 'DIRECT') {
        where.OR = [
          { firstTrafficSource: { contains: 'Direct', mode: 'insensitive' } },
          { firstTrafficSource: null }
        ];
      }
    }

    if (pagePath && pagePath.trim()) {
      where.pageVisits = {
        some: { pagePath: { contains: pagePath.trim(), mode: 'insensitive' } }
      };
    }

    if (startDate || endDate) {
      where.lastVisitAt = {};
      if (startDate) where.lastVisitAt.gte = new Date(startDate);
      if (endDate) {
        const endD = new Date(endDate);
        endD.setHours(23, 59, 59, 999);
        where.lastVisitAt.lte = endD;
      }
    }

    // Live Tab filter: only visitors active in the last 90 seconds
    if (tab === 'live') {
      where.lastVisitAt = { gte: liveCutoff };
    }

    // Fetch total count and visitors in parallel
    const [totalVisitors, rawVisitors, liveCount, totalPageVisits] = await Promise.all([
      prisma.analyticsVisitor.count({ where }),
      prisma.analyticsVisitor.findMany({
        where,
        orderBy: { lastVisitAt: 'desc' },
        skip,
        take: limit,
        include: {
          pageVisits: {
            orderBy: { enteredAt: 'desc' },
            take: 1
          },
          sessions: {
            orderBy: { startedAt: 'desc' },
            take: 1
          },
          _count: {
            select: { pageVisits: true, sessions: true }
          }
        }
      }),
      prisma.analyticsVisitor.count({
        where: { lastVisitAt: { gte: liveCutoff } }
      }),
      prisma.analyticsPageVisit.count()
    ]);

    // Format visitor rows with detailed timing and live/inactive/ended logic
    const visitors = rawVisitors.map((v) => {
      const latestVisit = v.pageVisits[0] || null;
      const latestSession = v.sessions[0] || null;

      let computedStatus = 'ENDED';
      let isLive = false;

      if (latestVisit) {
        const timeSinceLastActivity = now.getTime() - new Date(latestVisit.lastActivityAt).getTime();
        
        if (latestVisit.status === 'ENDED') {
          computedStatus = 'ENDED';
          isLive = false;
        } else if (timeSinceLastActivity <= LIVE_THRESHOLD_MS) {
          if (latestVisit.status === 'INACTIVE') {
            computedStatus = 'INACTIVE';
          } else {
            computedStatus = 'ACTIVE';
          }
          isLive = true;
        } else {
          // If no activity in > 90s and leftAt not explicitly sent (e.g. abrupt exit / tab closed)
          computedStatus = 'ENDED';
          isLive = false;
        }
      }

      // Filter by status if specified in query
      const estimatedEndTime = latestVisit?.leftAt || latestVisit?.lastActivityAt || null;

      const fallbackTraffic = (latestVisit?.referrer || latestSession?.userAgent)
        ? parseTrafficSource(latestVisit?.referrer || '', {}, latestSession?.userAgent || '')
        : { source: 'Direct / Chrome Search', medium: 'direct' };
      const trafficSource = latestSession?.trafficSource || v.firstTrafficSource || fallbackTraffic.source;
      const trafficMedium = latestSession?.trafficMedium || v.firstTrafficMedium || fallbackTraffic.medium;
      const utmCampaign = latestSession?.utmCampaign || null;

      // Compute the most accurate total active seconds for this visitor
      const visitorTotalActiveSeconds = Math.max(
        v.totalActiveSeconds || 0,
        latestVisit?.activeSeconds || 0,
        (latestVisit?.status === 'ENDED' ? (latestVisit?.durationSeconds || 0) : 0)
      );

      return {
        visitorId: v.id,
        firstVisitAt: v.firstVisitAt,
        lastVisitAt: v.lastVisitAt,
        totalVisits: v.totalVisits,
        totalPageVisits: v._count.pageVisits,
        totalSessions: v._count.sessions,
        totalActiveSeconds: visitorTotalActiveSeconds,
        deviceType: v.deviceType || 'Desktop',
        browser: v.browser || 'Unknown',
        os: v.os || 'Unknown',
        trafficSource,
        trafficMedium,
        utmCampaign,
        referrer: latestVisit?.referrer || latestSession?.referrer || null,
        status: computedStatus,
        isLive,
        currentOrLastPage: latestVisit ? {
          id: latestVisit.id,
          pagePath: latestVisit.pagePath,
          pageTitle: latestVisit.pageTitle || latestVisit.pagePath,
          enteredAt: latestVisit.enteredAt,
          lastActivityAt: latestVisit.lastActivityAt,
          leftAt: latestVisit.leftAt,
          estimatedEndTime,
          durationSeconds: latestVisit.durationSeconds,
          activeSeconds: latestVisit.activeSeconds,
          isExactEndTime: !!latestVisit.leftAt,
          status: computedStatus
        } : null
      };
    });

    // Apply status filter in-memory if requested (ACTIVE, INACTIVE, ENDED)
    let filteredVisitors = visitors;
    if (status && ['ACTIVE', 'INACTIVE', 'ENDED'].includes(status.toUpperCase())) {
      filteredVisitors = visitors.filter((v) => v.status === status.toUpperCase());
    }

    return res.json({
      visitors: filteredVisitors,
      pagination: {
        page,
        limit,
        total: totalVisitors,
        totalPages: Math.ceil(totalVisitors / limit) || 1
      },
      stats: {
        liveVisitorsCount: liveCount,
        totalVisitorsCount: totalVisitors,
        totalPageVisitsCount: totalPageVisits
      }
    });
  } catch (error) {
    console.error('Error in getAnalyticsVisitors:', error);
    return res.status(500).json({ error: 'Failed to fetch visitor analytics' });
  }
};

// 6. Main Admin: Get Visitor Detail with Complete Chronological Visit History
export const getAnalyticsVisitorDetail = async (req, res) => {
  try {
    const { visitorId } = req.params;

    if (!isValidId(visitorId)) {
      return res.status(400).json({ error: 'Invalid visitor ID' });
    }

    const visitor = await prisma.analyticsVisitor.findUnique({
      where: { id: visitorId },
      include: {
        sessions: {
          orderBy: { startedAt: 'desc' },
          include: {
            pageVisits: {
              orderBy: { enteredAt: 'asc' }
            }
          }
        },
        pageVisits: {
          orderBy: { enteredAt: 'desc' }
        }
      }
    });

    if (!visitor) {
      return res.status(404).json({ error: 'Visitor not found' });
    }

    const now = new Date();
    const LIVE_THRESHOLD_MS = 90 * 1000;

    // Process page visits with calculated statuses and readable durations
    const processedVisits = visitor.pageVisits.map((v) => {
      const timeSinceLastActivity = now.getTime() - new Date(v.lastActivityAt).getTime();
      let status = v.status;
      if (status !== 'ENDED' && timeSinceLastActivity > LIVE_THRESHOLD_MS) {
        status = 'ENDED';
      }

      return {
        id: v.id,
        sessionId: v.sessionId,
        pagePath: v.pagePath,
        pageTitle: v.pageTitle || v.pagePath,
        enteredAt: v.enteredAt,
        lastActivityAt: v.lastActivityAt,
        leftAt: v.leftAt,
        estimatedEndTime: v.leftAt || v.lastActivityAt,
        durationSeconds: v.durationSeconds,
        activeSeconds: v.activeSeconds,
        status,
        isExactEndTime: !!v.leftAt
      };
    });

    const computedPageActive = visitor.pageVisits.reduce((acc, v) => acc + (v.activeSeconds || 0), 0);
    const totalActiveSeconds = Math.max(visitor.totalActiveSeconds || 0, computedPageActive);
    const totalDurationSeconds = visitor.pageVisits.reduce((acc, v) => acc + (v.durationSeconds || 0), 0);

    return res.json({
      visitor: {
        id: visitor.id,
        firstVisitAt: visitor.firstVisitAt,
        lastVisitAt: visitor.lastVisitAt,
        totalVisits: visitor.totalVisits,
        deviceType: visitor.deviceType,
        browser: visitor.browser,
        os: visitor.os,
        ipAddress: visitor.ipAddress,
        firstTrafficSource: visitor.firstTrafficSource || (visitor.sessions[0]?.trafficSource) || 'Direct / Chrome Search',
        firstTrafficMedium: visitor.firstTrafficMedium || (visitor.sessions[0]?.trafficMedium) || 'direct',
        createdAt: visitor.createdAt
      },
      summary: {
        totalSessions: visitor.sessions.length,
        totalPageVisits: visitor.pageVisits.length,
        totalActiveSeconds,
        totalDurationSeconds
      },
      sessions: visitor.sessions,
      pageVisits: processedVisits
    });
  } catch (error) {
    console.error('Error in getAnalyticsVisitorDetail:', error);
    return res.status(500).json({ error: 'Failed to fetch visitor details' });
  }
};
