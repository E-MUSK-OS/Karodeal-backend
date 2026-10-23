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

    const { search, status, pagePath, startDate, endDate, tab, source, visitorType } = req.query;

    const now = new Date();
    // A visitor is considered currently LIVE if they had confirmed activity within the last 90 seconds
    const LIVE_THRESHOLD_MS = 90 * 1000;
    const liveCutoff = new Date(now.getTime() - LIVE_THRESHOLD_MS);

    // Build filter conditions
    const where = {};
    const andConditions = [];

    if (search && search.trim()) {
      andConditions.push({
        OR: [
          { id: { contains: search.trim(), mode: 'insensitive' } },
          { pageVisits: { some: { pagePath: { contains: search.trim(), mode: 'insensitive' } } } }
        ]
      });
    }

    const normalizedSource = typeof source === 'string' ? source.trim().toUpperCase() : '';
    if (normalizedSource && normalizedSource !== 'ALL') {
      if (normalizedSource === 'WHATSAPP') {
        andConditions.push({
          OR: [
            { firstTrafficSource: { contains: 'WhatsApp', mode: 'insensitive' } },
            { firstTrafficMedium: { contains: 'whatsapp', mode: 'insensitive' } },
            { sessions: { some: { trafficSource: { contains: 'WhatsApp', mode: 'insensitive' } } } },
            { sessions: { some: { trafficMedium: { contains: 'whatsapp', mode: 'insensitive' } } } },
            { sessions: { some: { utmCampaign: { contains: 'WhatsApp', mode: 'insensitive' } } } },
            { pageVisits: { some: { referrer: { contains: 'whatsapp', mode: 'insensitive' } } } }
          ]
        });
      } else if (normalizedSource === 'GOOGLE_ADS') {
        andConditions.push({
          OR: [
            { firstTrafficSource: { contains: 'Google Ads', mode: 'insensitive' } },
            {
              AND: [
                { firstTrafficSource: { contains: 'Google', mode: 'insensitive' } },
                { firstTrafficMedium: { in: ['cpc', 'paid', 'ad', 'ads', 'ppc'] } }
              ]
            },
            { sessions: { some: { trafficSource: { contains: 'Google Ads', mode: 'insensitive' } } } },
            {
              sessions: {
                some: {
                  trafficSource: { contains: 'Google', mode: 'insensitive' },
                  trafficMedium: { in: ['cpc', 'paid', 'ad', 'ads', 'ppc'] }
                }
              }
            }
          ]
        });
      } else if (normalizedSource === 'META_ADS') {
        andConditions.push({
          OR: [
            { firstTrafficSource: { contains: 'Meta Ads', mode: 'insensitive' } },
            { firstTrafficSource: { contains: 'Facebook Ads', mode: 'insensitive' } },
            { firstTrafficSource: { contains: 'Instagram Ads', mode: 'insensitive' } },
            {
              AND: [
                { firstTrafficSource: { in: ['Facebook', 'Instagram', 'Meta'] } },
                { firstTrafficMedium: { in: ['cpc', 'paid_social', 'paid', 'ads'] } }
              ]
            },
            { sessions: { some: { trafficSource: { contains: 'Meta Ads', mode: 'insensitive' } } } },
            { sessions: { some: { trafficSource: { contains: 'Facebook Ads', mode: 'insensitive' } } } },
            { sessions: { some: { trafficSource: { contains: 'Instagram Ads', mode: 'insensitive' } } } },
            { sessions: { some: { trafficMedium: 'paid_social' } } }
          ]
        });
      } else if (normalizedSource === 'INSTAGRAM') {
        andConditions.push({
          OR: [
            {
              AND: [
                { firstTrafficSource: { contains: 'Instagram', mode: 'insensitive' } },
                { NOT: { firstTrafficMedium: { in: ['cpc', 'paid_social', 'paid', 'ads'] } } },
                { NOT: { firstTrafficSource: { contains: 'Ads', mode: 'insensitive' } } }
              ]
            },
            {
              sessions: {
                some: {
                  trafficSource: { contains: 'Instagram', mode: 'insensitive' },
                  NOT: { trafficMedium: { in: ['cpc', 'paid_social', 'paid', 'ads'] } },
                  NOT: { trafficSource: { contains: 'Ads', mode: 'insensitive' } }
                }
              }
            },
            { pageVisits: { some: { referrer: { contains: 'instagram', mode: 'insensitive' } } } },
            { sessions: { some: { userAgent: { contains: 'instagram', mode: 'insensitive' } } } }
          ]
        });
      } else if (normalizedSource === 'ADS') {
        andConditions.push({
          OR: [
            { firstTrafficMedium: { in: ['cpc', 'paid_social', 'ads', 'ppc'] } },
            { firstTrafficSource: { contains: 'Ads', mode: 'insensitive' } },
            { sessions: { some: { trafficMedium: { in: ['cpc', 'paid_social', 'ads', 'ppc'] } } } },
            { sessions: { some: { trafficSource: { contains: 'Ads', mode: 'insensitive' } } } },
            { sessions: { some: { utmCampaign: { not: null } } } }
          ]
        });
      } else if (normalizedSource === 'SEARCH') {
        andConditions.push({
          OR: [
            { firstTrafficSource: { contains: 'Search', mode: 'insensitive' } },
            { firstTrafficMedium: 'organic' },
            { sessions: { some: { trafficSource: { contains: 'Search', mode: 'insensitive' } } } },
            { sessions: { some: { trafficMedium: 'organic' } } }
          ]
        });
      } else if (normalizedSource === 'SOCIAL') {
        andConditions.push({
          OR: [
            {
              AND: [
                { firstTrafficMedium: 'social' },
                { NOT: { firstTrafficSource: { contains: 'WhatsApp', mode: 'insensitive' } } },
                { NOT: { firstTrafficSource: { contains: 'Instagram', mode: 'insensitive' } } }
              ]
            },
            {
              sessions: {
                some: {
                  trafficMedium: 'social',
                  NOT: { trafficSource: { contains: 'WhatsApp', mode: 'insensitive' } },
                  NOT: { trafficSource: { contains: 'Instagram', mode: 'insensitive' } }
                }
              }
            }
          ]
        });
      } else if (normalizedSource === 'DIRECT') {
        andConditions.push({
          OR: [
            { firstTrafficSource: { contains: 'Direct', mode: 'insensitive' } },
            { firstTrafficSource: null }
          ]
        });
      }
    }

    if (pagePath && pagePath.trim()) {
      where.pageVisits = {
        some: { pagePath: { contains: pagePath.trim(), mode: 'insensitive' } }
      };
    }

    // Date filter: defaults to TODAY in Asia/Kolkata (IST) if no date is provided and not explicitly 'ALL'
    const isExplicitAllTime = req.query.period === 'ALL' || req.query.allTime === 'true';

    let dateGte = null;
    let dateLte = null;

    if (!isExplicitAllTime) {
      if (startDate || endDate) {
        if (startDate) {
          dateGte = new Date(startDate.includes('T') ? startDate : `${startDate}T00:00:00+05:30`);
        }
        if (endDate) {
          dateLte = new Date(endDate.includes('T') ? endDate : `${endDate}T23:59:59.999+05:30`);
        }
      } else {
        // Default to TODAY in Asia/Kolkata
        const nowIstStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        dateGte = new Date(`${nowIstStr}T00:00:00+05:30`);
        dateLte = new Date(`${nowIstStr}T23:59:59.999+05:30`);
      }
    }

    if (dateGte || dateLte) {
      where.lastVisitAt = {};
      if (dateGte) where.lastVisitAt.gte = dateGte;
      if (dateLte) where.lastVisitAt.lte = dateLte;
    }

    // Live Tab filter: only visitors active in the last 90 seconds
    if (tab === 'live') {
      where.lastVisitAt = { ...where.lastVisitAt, gte: liveCutoff };
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    // Clone baseWhere before applying visitorType filter to calculate total new/returning metrics accurately
    const baseWhere = { ...where };

    const newCountWhere = {
      ...baseWhere,
      ...(dateGte
        ? { firstVisitAt: { gte: dateGte, ...(dateLte ? { lte: dateLte } : {}) } }
        : { totalVisits: 1 })
    };

    const normalizedVisitorType = typeof visitorType === 'string' ? visitorType.trim().toUpperCase() : 'ALL';
    if (normalizedVisitorType === 'NEW') {
      if (dateGte) {
        where.firstVisitAt = { gte: dateGte, ...(dateLte ? { lte: dateLte } : {}) };
      } else {
        where.totalVisits = 1;
      }
    } else if (normalizedVisitorType === 'RETURNING') {
      if (dateGte) {
        where.firstVisitAt = { lt: dateGte };
      } else {
        where.totalVisits = { gt: 1 };
      }
    }

    const pageVisitWhere = {};
    if (where.lastVisitAt) {
      pageVisitWhere.enteredAt = where.lastVisitAt;
    }

    // Fetch total count, new visitors count, raw visitors, live count, and total page visits in parallel
    const [totalVisitors, newVisitorsCount, rawVisitors, liveCount, totalPageVisits] = await Promise.all([
      prisma.analyticsVisitor.count({ where }),
      prisma.analyticsVisitor.count({ where: newCountWhere }),
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
      prisma.analyticsPageVisit.count({ where: pageVisitWhere })
    ]);

    let overallTotalVisitors = totalVisitors;
    if (normalizedVisitorType !== 'ALL') {
      overallTotalVisitors = await prisma.analyticsVisitor.count({ where: baseWhere });
    }
    const returningVisitorsCount = Math.max(0, overallTotalVisitors - newVisitorsCount);

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
      let trafficSource = latestSession?.trafficSource || v.firstTrafficSource || fallbackTraffic.source;
      let trafficMedium = latestSession?.trafficMedium || v.firstTrafficMedium || fallbackTraffic.medium;
      let utmCampaign = latestSession?.utmCampaign || null;

      // Handle legacy / unparsed android-app: references
      if (trafficSource === 'android-app:' || trafficSource?.startsWith('android-app')) {
        const reParsed = parseTrafficSource(latestVisit?.referrer || latestSession?.referrer || '', {}, latestSession?.userAgent || '');
        if (reParsed && reParsed.source !== 'android-app:' && !reParsed.source.startsWith('android-app')) {
          trafficSource = reParsed.source;
          trafficMedium = reParsed.medium;
          utmCampaign = utmCampaign || reParsed.campaign;
        } else {
          trafficSource = 'Google Search';
          trafficMedium = 'organic';
        }
      }

      // If filtering by specific source, ensure the badge explicitly shows the matching source
      if (normalizedSource === 'WHATSAPP') {
        const isWa = /whatsapp/i.test(trafficSource || '') || /whatsapp/i.test(trafficMedium || '');
        if (!isWa) {
          trafficSource = 'WhatsApp';
          trafficMedium = 'social';
          utmCampaign = utmCampaign || 'WhatsApp Share';
        }
      } else if (normalizedSource === 'GOOGLE_ADS') {
        const isGAd = /google.*ad|ad.*google/i.test(trafficSource || '') || (trafficSource?.includes('Google') && trafficMedium === 'cpc');
        if (!isGAd) {
          trafficSource = 'Google Ads';
          trafficMedium = 'cpc';
          utmCampaign = utmCampaign || 'Google Search Ads';
        }
      } else if (normalizedSource === 'META_ADS') {
        const isMeta = /meta|facebook.*ad|instagram.*ad/i.test(trafficSource || '') || trafficMedium === 'paid_social';
        if (!isMeta) {
          trafficSource = 'Meta Ads';
          trafficMedium = 'paid_social';
          utmCampaign = utmCampaign || 'Meta Paid Ads';
        }
      } else if (normalizedSource === 'INSTAGRAM') {
        const isInsta = /instagram/i.test(trafficSource || '') && !/ad/i.test(trafficSource || '');
        if (!isInsta) {
          trafficSource = 'Instagram';
          trafficMedium = 'social';
        }
      }

      // Compute the most accurate total active seconds for this visitor
      const visitorTotalActiveSeconds = Math.max(
        v.totalActiveSeconds || 0,
        latestVisit?.activeSeconds || 0,
        (latestVisit?.status === 'ENDED' ? (latestVisit?.durationSeconds || 0) : 0)
      );

      // Extract phone / WhatsApp number if embedded in campaign or params
      let whatsappNumber = null;
      const campaignToCheck = utmCampaign || latestSession?.utmCampaign || '';
      if (campaignToCheck) {
        const phoneMatch = campaignToCheck.match(/(?:phone:|whatsapp:|\+91|wa:)?\s*(\+?91?[6-9]\d{9})/i);
        if (phoneMatch && phoneMatch[1]) {
          whatsappNumber = phoneMatch[1].replace(/^\+?91/, '').trim();
        }
      }

      const isNewVisitor = dateGte
        ? (new Date(v.firstVisitAt).getTime() >= dateGte.getTime())
        : (v.totalVisits <= 1);

      return {
        visitorId: v.id,
        firstVisitAt: v.firstVisitAt,
        lastVisitAt: v.lastVisitAt,
        totalVisits: v.totalVisits,
        isNewVisitor,
        totalPageVisits: v._count.pageVisits,
        totalSessions: v._count.sessions,
        totalActiveSeconds: visitorTotalActiveSeconds,
        deviceType: v.deviceType || 'Desktop',
        browser: v.browser || 'Unknown',
        os: v.os || 'Unknown',
        trafficSource,
        trafficMedium,
        utmCampaign,
        whatsappNumber,
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
        totalVisitorsCount: overallTotalVisitors,
        newVisitorsCount: newVisitorsCount,
        returningVisitorsCount: returningVisitorsCount,
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

    // Identify First Landing Page Chronologically
    const sortedVisitsChronological = [...visitor.pageVisits].sort((a, b) => new Date(a.enteredAt) - new Date(b.enteredAt));
    const landingVisit = sortedVisitsChronological[0] || null;

    // Search query / keyword extraction from campaigns or referrer URLs
    let detectedKeyword = null;
    for (const session of visitor.sessions) {
      if (session.utmCampaign && /keyword:|query:|term:/i.test(session.utmCampaign)) {
        const match = session.utmCampaign.match(/(?:keyword:|query:|term:)\s*["']?([^\]"']+)["']?/i);
        if (match && match[1]) {
          detectedKeyword = match[1].trim();
          break;
        }
      }
      if (session.referrer && session.referrer.includes('?')) {
        try {
          const url = new URL(session.referrer.startsWith('http') ? session.referrer : `http://${session.referrer}`);
          const q = url.searchParams.get('q') || url.searchParams.get('query') || url.searchParams.get('p');
          if (q) {
            detectedKeyword = decodeURIComponent(q);
            break;
          }
        } catch (e) {}
      }
    }

    // Extract phone / WhatsApp number if embedded in any session's campaign
    let whatsappNumber = null;
    for (const session of visitor.sessions) {
      if (session.utmCampaign) {
        const phoneMatch = session.utmCampaign.match(/(?:phone:|whatsapp:|\+91|wa:)?\s*(\+?91?[6-9]\d{9})/i);
        if (phoneMatch && phoneMatch[1]) {
          whatsappNumber = phoneMatch[1].replace(/^\+?91/, '').trim();
          break;
        }
      }
    }

    return res.json({
      visitor: {
        id: visitor.id,
        firstVisitAt: visitor.firstVisitAt,
        lastVisitAt: visitor.lastVisitAt,
        totalVisits: visitor.totalVisits,
        isNewVisitor: visitor.totalVisits <= 1,
        deviceType: visitor.deviceType,
        browser: visitor.browser,
        os: visitor.os,
        ipAddress: visitor.ipAddress,
        firstTrafficSource: visitor.firstTrafficSource || (visitor.sessions[0]?.trafficSource) || 'Direct / Chrome Search',
        firstTrafficMedium: visitor.firstTrafficMedium || (visitor.sessions[0]?.trafficMedium) || 'direct',
        landingPage: landingVisit ? {
          pagePath: landingVisit.pagePath,
          pageTitle: landingVisit.pageTitle || landingVisit.pagePath,
          enteredAt: landingVisit.enteredAt
        } : null,
        detectedKeyword,
        whatsappNumber,
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
