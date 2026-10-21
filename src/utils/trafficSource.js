/**
 * Traffic Source & Acquisition Parser for Karodeal Analytics
 * Categorizes visitors into Direct/Chrome Search, Organic Search, Social Media, Paid Ads, or External Referrals.
 */
export function parseTrafficSource(rawReferrer = '', queryParams = {}) {
  const params = queryParams && typeof queryParams === 'object' ? queryParams : {};
  
  const utmSource = (params.utm_source || '').toLowerCase().trim();
  const utmMedium = (params.utm_medium || '').toLowerCase().trim();
  const utmCampaign = (params.utm_campaign || '').trim();
  const gclid = params.gclid;
  const fbclid = params.fbclid;
  const ttclid = params.ttclid;

  // 1. Paid Ads Detection (Google Ads, Meta Ads, TikTok Ads, UTM CPC/Paid)
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

  // 2. Custom UTM Source without explicit paid medium
  if (utmSource) {
    let category = 'REFERRAL';
    let medium = utmMedium || 'referral';

    if (/facebook|instagram|insta|twitter|x\.com|linkedin|youtube|pinterest|whatsapp|telegram|tiktok|reddit/i.test(utmSource)) {
      category = 'SOCIAL';
      medium = 'social';
    } else if (/email|newsletter/i.test(utmMedium) || /email/i.test(utmSource)) {
      category = 'EMAIL';
      medium = 'email';
    }

    const formatted = utmSource.charAt(0).toUpperCase() + utmSource.slice(1);
    return {
      source: formatted,
      medium,
      campaign: utmCampaign || null,
      category
    };
  }

  // 3. Document Referrer Inspection
  const ref = (rawReferrer || '').toLowerCase().trim();

  // If no referrer exists, user visited directly or opened Chrome / typed URL / private tab
  if (!ref || ref === 'direct') {
    return {
      source: 'Direct / Chrome Search',
      medium: 'direct',
      campaign: null,
      category: 'DIRECT'
    };
  }

  try {
    let hostname = '';
    if (ref.startsWith('http://') || ref.startsWith('https://')) {
      hostname = new URL(ref).hostname.replace(/^www\./, '');
    } else {
      hostname = ref.split('/')[0].replace(/^www\./, '');
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
    if (/whatsapp\./i.test(hostname)) {
      return { source: 'WhatsApp', medium: 'social', campaign: null, category: 'SOCIAL' };
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
