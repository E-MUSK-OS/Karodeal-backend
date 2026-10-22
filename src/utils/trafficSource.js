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
  const utmTerm = String(params.utm_term || params.keyword || params.term || params.q || params.query || '').trim();
  const gclid = params.gclid;
  const fbclid = params.fbclid;
  const ttclid = params.ttclid;
  const rawRef = String(rawReferrer || '').toLowerCase().trim();

  // Extract search query keyword if present in referrer URL (e.g. ?q= or ?query=)
  let referrerQuery = '';
  try {
    if (rawRef.includes('?')) {
      const refUrl = new URL(rawRef.startsWith('http') ? rawRef : `http://${rawRef}`);
      referrerQuery = refUrl.searchParams.get('q') || refUrl.searchParams.get('query') || refUrl.searchParams.get('p') || '';
    }
  } catch (e) {}
  const searchKeyword = utmTerm || referrerQuery || null;

  // Extract Phone / Mobile if provided in URL params (e.g. ?phone=9876543210 or ?wa=9876543210)
  const rawPhone = String(params.phone || params.mobile || params.wa_phone || params.wa_num || params.contact || '').replace(/[^\d+]/g, '').trim();
  const phone = (rawPhone.length >= 10 && rawPhone.length <= 15) ? rawPhone : null;

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
    let waCampaign = utmCampaign || params.campaign || (isWaParam ? 'WhatsApp Marketing' : null);
    if (phone) {
      waCampaign = waCampaign ? `${waCampaign} [Phone: ${phone}]` : `WhatsApp: ${phone}`;
    }
    return {
      source: 'WhatsApp',
      medium: utmMedium || 'social',
      campaign: waCampaign,
      category: 'WHATSAPP',
      phone,
      searchKeyword
    };
  }

  // 2. Paid Ads Detection (Google Ads vs Meta Ads vs TikTok / Other Ads)
  // Google Ads (gclid or utm_source google with paid medium)
  if (gclid || (utmSource.includes('google') && ['cpc', 'paid', 'ad', 'ads', 'ppc'].includes(utmMedium))) {
    const campaignText = utmCampaign 
      ? (searchKeyword ? `${utmCampaign} [Keyword: ${searchKeyword}]` : utmCampaign)
      : (searchKeyword ? `Keyword: ${searchKeyword}` : 'Google Search Ads');
    return {
      source: 'Google Ads',
      medium: 'cpc',
      campaign: campaignText,
      category: 'GOOGLE_ADS',
      searchKeyword
    };
  }

  // Meta Ads (fbclid or facebook/instagram/meta with paid medium)
  if (
    fbclid ||
    (['facebook', 'instagram', 'meta', 'fb', 'insta'].some((s) => utmSource.includes(s)) &&
      ['cpc', 'paid', 'ads', 'ppc', 'paid_social', 'ad'].includes(utmMedium)) ||
    (utmCampaign && /meta_ad|fb_ad|insta_ad|facebook_ad/i.test(utmCampaign))
  ) {
    return {
      source: 'Meta Ads',
      medium: 'paid_social',
      campaign: utmCampaign || 'Meta Paid Ads',
      category: 'META_ADS'
    };
  }

  // TikTok Ads
  if (ttclid || (utmSource.includes('tiktok') && (utmMedium === 'cpc' || utmMedium === 'paid'))) {
    return {
      source: 'TikTok Ads',
      medium: 'paid_social',
      campaign: utmCampaign || 'TikTok Campaign',
      category: 'ADS'
    };
  }

  // Generic Paid Ads
  if (utmMedium === 'cpc' || utmMedium === 'ppc' || utmMedium === 'paid' || utmMedium === 'ads' || utmMedium === 'sponsored') {
    const formattedSource = utmSource ? utmSource.charAt(0).toUpperCase() + utmSource.slice(1) + ' Ads' : 'Paid Ads';
    return {
      source: formattedSource,
      medium: utmMedium,
      campaign: utmCampaign || 'Paid Campaign',
      category: 'ADS'
    };
  }

  // 3. Instagram Organic / In-App Browser Detection
  if (
    ua.includes('instagram') ||
    /instagram\.com|com\.instagram\.android/i.test(rawRef) ||
    utmSource === 'instagram' ||
    utmSource === 'insta' ||
    utmSource.includes('instagram')
  ) {
    return {
      source: 'Instagram',
      medium: utmMedium || 'social',
      campaign: utmCampaign || null,
      category: 'INSTAGRAM'
    };
  }

  // 4. Other In-App Mobile Browsers
  if (ua.includes('fban') || ua.includes('fbav') || ua.includes('fb_iab')) {
    return { source: 'Facebook', medium: 'social', campaign: utmCampaign || null, category: 'SOCIAL' };
  }
  if (ua.includes('linkedinapp')) {
    return { source: 'LinkedIn', medium: 'social', campaign: utmCampaign || null, category: 'SOCIAL' };
  }
  if (ua.includes('twitter')) {
    return { source: 'Twitter / X', medium: 'social', campaign: utmCampaign || null, category: 'SOCIAL' };
  }

  // 5. Custom UTM / Referral Source
  if (utmSource) {
    let category = 'REFERRAL';
    let medium = utmMedium || 'referral';

    if (utmSource === 'wa' || /whatsapp/i.test(utmSource)) {
      category = 'WHATSAPP';
      medium = 'social';
    } else if (utmSource === 'instagram' || utmSource === 'insta' || /instagram/i.test(utmSource)) {
      category = 'INSTAGRAM';
      medium = 'social';
    } else if (/facebook|twitter|x\.com|linkedin|youtube|pinterest|telegram|tiktok|reddit/i.test(utmSource)) {
      category = 'SOCIAL';
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

  // 6. Document Referrer Inspection
  if (!rawRef || rawRef === 'direct') {
    return {
      source: 'Direct / Chrome Search',
      medium: 'direct',
      campaign: null,
      category: 'DIRECT'
    };
  }

  try {
    // 6a. Android Native App Referrers (e.g. android-app://com.google.android.googlequicksearchbox)
    if (rawRef.startsWith('android-app://')) {
      const appPackage = rawRef.replace('android-app://', '').split('/')[0].toLowerCase();

      // Google App / Discover / Google Search App on Android
      if (/googlequicksearchbox|quicksearchbox/i.test(appPackage)) {
        return {
          source: 'Google Search',
          medium: 'organic',
          campaign: searchKeyword ? `Keyword: "${searchKeyword}"` : 'Google App',
          category: 'SEARCH',
          searchKeyword
        };
      }
      if (/whatsapp/i.test(appPackage)) {
        return { source: 'WhatsApp', medium: 'social', campaign: null, category: 'WHATSAPP' };
      }
      if (/instagram/i.test(appPackage)) {
        return { source: 'Instagram', medium: 'social', campaign: null, category: 'INSTAGRAM' };
      }
      if (/facebook|katana|orca/i.test(appPackage)) {
        return { source: 'Facebook', medium: 'social', campaign: null, category: 'SOCIAL' };
      }
      if (/telegram/i.test(appPackage)) {
        return { source: 'Telegram', medium: 'social', campaign: null, category: 'SOCIAL' };
      }
      if (/twitter/i.test(appPackage)) {
        return { source: 'Twitter / X', medium: 'social', campaign: null, category: 'SOCIAL' };
      }
      if (/linkedin/i.test(appPackage)) {
        return { source: 'LinkedIn', medium: 'social', campaign: null, category: 'SOCIAL' };
      }
      if (/gmail|\.gm/i.test(appPackage)) {
        return { source: 'Gmail', medium: 'email', campaign: null, category: 'EMAIL' };
      }
      if (/chrome/i.test(appPackage)) {
        return { source: 'Direct / Chrome Search', medium: 'direct', campaign: null, category: 'DIRECT' };
      }

      const rawApp = appPackage.split('.').pop() || 'App';
      const cleanApp = rawApp.charAt(0).toUpperCase() + rawApp.slice(1);
      return {
        source: `${cleanApp} App`,
        medium: 'referral',
        campaign: null,
        category: 'REFERRAL'
      };
    }

    let hostname = '';
    if (rawRef.startsWith('http://') || rawRef.startsWith('https://')) {
      hostname = new URL(rawRef).hostname.replace(/^www\./, '');
    } else {
      hostname = rawRef.split('/')[0].replace(/^www\./, '');
    }

    // Search Engines (Organic)
    if (/google\./i.test(hostname)) {
      return {
        source: 'Google Search',
        medium: 'organic',
        campaign: searchKeyword ? `Keyword: "${searchKeyword}"` : null,
        category: 'SEARCH',
        searchKeyword
      };
    }
    if (/bing\.com/i.test(hostname)) {
      return {
        source: 'Bing Search',
        medium: 'organic',
        campaign: searchKeyword ? `Keyword: "${searchKeyword}"` : null,
        category: 'SEARCH',
        searchKeyword
      };
    }
    if (/yahoo\./i.test(hostname)) {
      return {
        source: 'Yahoo Search',
        medium: 'organic',
        campaign: searchKeyword ? `Keyword: "${searchKeyword}"` : null,
        category: 'SEARCH',
        searchKeyword
      };
    }
    if (/duckduckgo\.com/i.test(hostname)) {
      return { source: 'DuckDuckGo', medium: 'organic', campaign: null, category: 'SEARCH' };
    }
    if (/ecosia\.org|yandex\./i.test(hostname)) {
      return { source: 'Search Engine', medium: 'organic', campaign: null, category: 'SEARCH' };
    }

    // WhatsApp
    if (/whatsapp|com\.whatsapp|wa\.me/i.test(rawRef) || /whatsapp/i.test(hostname)) {
      return { source: 'WhatsApp', medium: 'social', campaign: null, category: 'WHATSAPP' };
    }

    // Instagram (Organic / Share)
    if (/instagram\.com|com\.instagram\.android/i.test(hostname) || /instagram/i.test(rawRef)) {
      return { source: 'Instagram', medium: 'social', campaign: null, category: 'INSTAGRAM' };
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
