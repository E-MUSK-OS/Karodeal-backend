/**
 * Traffic Source & Acquisition Parser for Karodeal Analytics
 * Categorizes visitors into Direct/Chrome Search, Organic Search, Social Media (including WhatsApp), Paid Ads, or External Referrals.
 */
export function parseTrafficSource(rawReferrer = '', queryParams = {}, userAgent = '') {
  const params = queryParams && typeof queryParams === 'object' ? queryParams : {};
  const ua = (userAgent || '').toLowerCase();
  
  // Extract UTM / referral / source parameters (supports utm_source, source, ref, src)
  const rawSource = params.utm_source || params.source || params.ref || params.src || '';
  const utmSource = String(rawSource).toLowerCase().trim();
  const utmMedium = (params.utm_medium || params.medium || '').toLowerCase().trim();
  const utmCampaign = (params.utm_campaign || params.campaign || '').trim();
  const gclid = params.gclid;
  const fbclid = params.fbclid;
  const ttclid = params.ttclid;
  const rawRef = String(rawReferrer || '').toLowerCase().trim();

  // 1. WhatsApp Detection (via Param, Referrer, or In-App Browser User-Agent)
  const isWaParam = 
    params.wa === '1' || 
    params.wa === 'true' || 
    params.whatsapp === '1' || 
    params.whatsapp === 'true' || 
    utmSource === 'wa' || 
    utmSource === 'whatsapp' ||
    utmSource.includes('whatsapp') ||
    String(params.source || '').toLowerCase().includes('whatsapp') ||
    String(params.ref || '').toLowerCase() === 'wa' ||
    String(params.ref || '').toLowerCase().includes('whatsapp');

  const isWaReferrer = /whatsapp|com\.whatsapp|wa\.me|w4b/i.test(rawRef);
  const isWaUA = ua.includes('whatsapp');

  if (isWaParam || isWaReferrer || isWaUA) {
    return {
      source: 'WhatsApp',
      medium: utmMedium || 'social',
      campaign: utmCampaign || params.campaign || (isWaParam ? 'WhatsApp Marketing' : null),
      category: 'WHATSAPP'
    };
  }

  // 2. In-App Mobile Browser Detection from User-Agent (when native apps strip HTTP referrer headers)
  if (ua.includes('instagram')) {
    return { source: 'Instagram', medium: 'social', campaign: utmCampaign || null, category: 'SOCIAL' };
  }
  if (ua.includes('fban') || ua.includes('fbav') || ua.includes('fb_iab')) {
    return { source: 'Facebook', medium: 'social', campaign: utmCampaign || null, category: 'SOCIAL' };
  }
  if (ua.includes('linkedinapp')) {
    return { source: 'LinkedIn', medium: 'social', campaign: utmCampaign || null, category: 'SOCIAL' };
  }
  if (ua.includes('twitter')) {
    return { source: 'Twitter / X', medium: 'social', campaign: utmCampaign || null, category: 'SOCIAL' };
  }

  // 3. Paid Ads Detection (Google Ads, Meta Ads, TikTok Ads, UTM CPC/Paid)
  if (gclid || (utmSource.includes('google') && (utmMedium === 'cpc' || utmMedium === 'paid' || utmMedium === 'ad'))) {
    return {
      source: 'Google Ads',
      medium: 'cpc',
      campaign: utmCampaign || 'Google Paid Search',
      category: 'ADS'
    };
  }

  if (fbclid || (['facebook', 'instagram', 'meta'].some(s => utmSource.includes(s)) && (utmMedium === 'cpc' || utmMedium === 'paid' || utmMedium === 'ads'))) {
    return {
      source: 'Meta Ads (FB/Instagram)',
      medium: 'paid_social',
      campaign: utmCampaign || 'Meta Paid Ads',
      category: 'ADS'
    };
  }

  if (ttclid || (utmSource.includes('tiktok') && (utmMedium === 'cpc' || utmMedium === 'paid'))) {
    return {
      source: 'TikTok Ads',
      medium: 'paid_social',
      campaign: utmCampaign || 'TikTok Campaign',
      category: 'ADS'
    };
  }

  if (utmMedium === 'cpc' || utmMedium === 'ppc' || utmMedium === 'paid' || utmMedium === 'ads' || utmMedium === 'sponsored') {
    const formattedSource = utmSource ? utmSource.charAt(0).toUpperCase() + utmSource.slice(1) + ' Ads' : 'Paid Ads';
    return {
      source: formattedSource,
      medium: utmMedium,
      campaign: utmCampaign || 'Paid Campaign',
      category: 'ADS'
    };
  }

  // 4. Custom UTM / Referral Source
  if (utmSource) {
    let category = 'REFERRAL';
    let medium = utmMedium || 'referral';

    if (/facebook|instagram|insta|twitter|x\.com|linkedin|youtube|pinterest|whatsapp|telegram|tiktok|reddit/i.test(utmSource)) {
      category = (utmSource === 'wa' || /whatsapp/i.test(utmSource)) ? 'WHATSAPP' : 'SOCIAL';
      medium = 'social';
    } else if (/email|newsletter/i.test(utmMedium) || /email/i.test(utmSource)) {
      category = 'EMAIL';
      medium = 'email';
    }

    const formatted = utmSource === 'wa' ? 'WhatsApp' : utmSource.charAt(0).toUpperCase() + utmSource.slice(1);
    return {
      source: formatted,
      medium,
      campaign: utmCampaign || null,
      category
    };
  }

  // 5. Document Referrer Inspection
  if (!rawRef || rawRef === 'direct') {
    return {
      source: 'Direct / Chrome Search',
      medium: 'direct',
      campaign: null,
      category: 'DIRECT'
    };
  }

  try {
    let hostname = '';
    if (rawRef.startsWith('http://') || rawRef.startsWith('https://')) {
      hostname = new URL(rawRef).hostname.replace(/^www\./, '');
    } else {
      hostname = rawRef.split('/')[0].replace(/^www\./, '');
    }

    // Search Engines (Organic)
    if (/google\./i.test(hostname)) {
      return { source: 'Google Search', medium: 'organic', campaign: null, category: 'SEARCH' };
    }
    if (/bing\.com/i.test(hostname)) {
      return { source: 'Bing Search', medium: 'organic', campaign: null, category: 'SEARCH' };
    }
    if (/yahoo\./i.test(hostname)) {
      return { source: 'Yahoo Search', medium: 'organic', campaign: null, category: 'SEARCH' };
    }
    if (/duckduckgo\.com/i.test(hostname)) {
      return { source: 'DuckDuckGo', medium: 'organic', campaign: null, category: 'SEARCH' };
    }
    if (/ecosia\.org|yandex\./i.test(hostname)) {
      return { source: 'Search Engine', medium: 'organic', campaign: null, category: 'SEARCH' };
    }

    // Social Media Platforms
    if (/whatsapp|com\.whatsapp|wa\.me/i.test(rawRef) || /whatsapp/i.test(hostname)) {
      return { source: 'WhatsApp', medium: 'social', campaign: null, category: 'WHATSAPP' };
    }
    if (/instagram\.com/i.test(hostname)) {
      return { source: 'Instagram', medium: 'social', campaign: null, category: 'SOCIAL' };
    }
    if (/facebook\.com|fb\.me/i.test(hostname)) {
      return { source: 'Facebook', medium: 'social', campaign: null, category: 'SOCIAL' };
    }
    if (/youtube\.com|youtu\.be/i.test(hostname)) {
      return { source: 'YouTube', medium: 'social', campaign: null, category: 'SOCIAL' };
    }
    if (/t\.co|twitter\.com|x\.com/i.test(hostname)) {
      return { source: 'Twitter / X', medium: 'social', campaign: null, category: 'SOCIAL' };
    }
    if (/linkedin\.com/i.test(hostname)) {
      return { source: 'LinkedIn', medium: 'social', campaign: null, category: 'SOCIAL' };
    }
    if (/pinterest\./i.test(hostname)) {
      return { source: 'Pinterest', medium: 'social', campaign: null, category: 'SOCIAL' };
    }
    if (/reddit\.com/i.test(hostname)) {
      return { source: 'Reddit', medium: 'social', campaign: null, category: 'SOCIAL' };
    }

    // Internal navigation on Karodeal itself
    if (/karodeal/i.test(hostname) || /localhost/i.test(hostname)) {
      return { source: 'Direct / Chrome Search', medium: 'direct', campaign: null, category: 'DIRECT' };
    }

    // Any other external website
    return {
      source: hostname,
      medium: 'referral',
      campaign: null,
      category: 'REFERRAL'
    };
  } catch (e) {
    return {
      source: 'Direct / Chrome Search',
      medium: 'direct',
      campaign: null,
      category: 'DIRECT'
    };
  }
}
