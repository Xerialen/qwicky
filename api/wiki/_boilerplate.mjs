// api/wiki/_boilerplate.mjs
// Assembles MediaWiki boilerplate (navbox + infobox + tabs) for tournament pages.
// Used by scaffold.mjs and auto-publish.mjs when creating new pages.

/**
 * Assemble full boilerplate for a tournament wiki page.
 *
 * @param {Object} config - Tournament wiki config
 * @param {string} config.navbox - Navbox template name (e.g., "TB4 Navbox")
 * @param {Object} config.infobox - Infobox field values
 * @param {Array}  config.tabs - Tab definitions [{name, link}]
 * @param {string} pageTitle - The page being created (to determine This= index)
 * @returns {string} Wikitext boilerplate
 */
export function assembleBoilerplate(config, pageTitle) {
  const { navbox, infobox, tabs } = config;
  const parts = [];

  // Navbox (tournament-specific template)
  if (navbox) {
    parts.push(`{{${navbox}}}`);
  }

  // Infobox league
  if (infobox && Object.keys(infobox).length > 0) {
    parts.push(renderInfobox(infobox));
  }

  // Tabs static (with correct This= for this page)
  if (tabs && tabs.length > 0) {
    const tabIndex = tabs.findIndex(t => t.link === pageTitle) + 1;
    parts.push(renderTabs(tabs, tabIndex || 1));
  }

  return parts.join('\n');
}

/**
 * Render {{Infobox league}} template.
 */
function renderInfobox(fields) {
  const lines = ['{{Infobox league'];
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null && value !== '') {
      lines.push(`|${key}=${value}`);
    }
  }
  lines.push('}}');
  return lines.join('\n');
}

/**
 * Render {{Tabs static}} template.
 *
 * @param {Array} tabs - [{name, link}]
 * @param {number} thisIndex - 1-based index of the current page's tab
 */
function renderTabs(tabs, thisIndex) {
  const lines = ['{{Tabs static'];
  tabs.forEach((tab, i) => {
    lines.push(`|name${i + 1}=${tab.name}`);
    lines.push(`|link${i + 1}=${tab.link}`);
  });
  lines.push(`|This=${thisIndex}`);
  lines.push('}}');
  return lines.join('\n');
}

/**
 * Build the page list for a tournament season.
 * Generates: Overview, one page per division, Playoffs, Information.
 *
 * @param {string} seasonPage - Base path (e.g., "The Big 4/Season 2")
 * @param {Array} divisionNames - Division names (e.g., ["Division 1", "Division 2", "Division 3"])
 * @returns {Array} [{name, link, type}]
 */
export function buildPageList(seasonPage, divisionNames) {
  const pages = [
    { name: 'Overview', link: seasonPage, type: 'overview' },
  ];

  for (const divName of divisionNames) {
    pages.push({
      name: divName,
      link: `${seasonPage}/${divName}`,
      type: 'division',
    });
  }

  pages.push({ name: 'Playoffs', link: `${seasonPage}/Playoffs`, type: 'playoffs' });
  pages.push({ name: 'Information', link: `${seasonPage}/Information`, type: 'information' });

  return pages;
}

/**
 * Build infobox fields from QWICKY tournament data.
 * Merges explicit overrides with auto-derived fields.
 *
 * @param {Object} tournament - QWICKY tournament object
 * @param {Object} overrides - Explicit field overrides from the wizard
 * @returns {Object} Infobox field map
 */
export function buildInfoboxFromTournament(tournament, overrides = {}) {
  // Collect maps from all divisions
  const allMaps = new Set();
  for (const div of tournament.divisions || []) {
    // Maps come from the map pool if configured, or from played maps
    for (const match of div.schedule || []) {
      for (const map of match.maps || []) {
        if (map.map) allMaps.add(map.map);
      }
    }
  }

  // Count teams
  const teamCount = (tournament.divisions || []).reduce(
    (sum, div) => sum + (div.teams?.length || 0), 0
  );

  const fields = {
    name: tournament.name || '',
    format: tournament.mode || '4on4',
    type: 'Online',
    sdate: tournament.startDate || '',
    edate: tournament.endDate || '',
    year: tournament.startDate ? tournament.startDate.split('-')[0] : '',
    team_number: teamCount || '',
  };

  // Add maps (map1 through map5)
  const mapArray = [...allMaps];
  mapArray.forEach((map, i) => {
    if (i < 5) fields[`map${i + 1}`] = map;
  });

  // Merge with explicit overrides (wizard-provided fields take priority)
  return { ...fields, ...overrides };
}

/**
 * Parse an existing {{Infobox league}} from wikitext to extract field values.
 *
 * @param {string} wikitext - Raw page content
 * @returns {Object|null} Parsed infobox fields, or null if not found
 */
export function parseInfobox(wikitext) {
  const match = wikitext.match(/\{\{Infobox league\s*\n([\s\S]*?)\}\}/i);
  if (!match) return null;

  const fields = {};
  const lines = match[1].split('\n');
  for (const line of lines) {
    const m = line.match(/^\|(\w+)\s*=\s*(.*?)\s*$/);
    if (m) {
      fields[m[1]] = m[2];
    }
  }
  return fields;
}

/**
 * Detect the navbox template name from existing wikitext.
 * Looks for the first template call before {{Infobox.
 *
 * @param {string} wikitext
 * @returns {string|null} Navbox template name or null
 */
export function detectNavbox(wikitext) {
  // Find templates before Infobox
  const infoboxPos = wikitext.indexOf('{{Infobox');
  if (infoboxPos <= 0) return null;

  const before = wikitext.substring(0, infoboxPos);
  const match = before.match(/\{\{([^{}|]+)\}\}/);
  return match ? match[1].trim() : null;
}

/**
 * Parse {{Tabs static}} from wikitext to extract tab structure.
 *
 * @param {string} wikitext
 * @returns {Array|null} [{name, link}] or null
 */
export function parseTabs(wikitext) {
  const match = wikitext.match(/\{\{Tabs static\s*\n([\s\S]*?)\}\}/i);
  if (!match) return null;

  const tabs = [];
  const lines = match[1].split('\n');
  let currentName = null;

  for (const line of lines) {
    const nameMatch = line.match(/^\|name(\d+)\s*=\s*(.*?)\s*$/);
    const linkMatch = line.match(/^\|link(\d+)\s*=\s*(.*?)\s*$/);

    if (nameMatch) currentName = nameMatch[2];
    if (linkMatch && currentName) {
      tabs.push({ name: currentName, link: linkMatch[2] });
      currentName = null;
    }
  }

  return tabs.length > 0 ? tabs : null;
}
