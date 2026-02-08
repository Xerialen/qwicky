// src/utils/teamImport.js
// Team import utilities for parsing, validating, and transforming team data from various sources

/**
 * Parse teams from bulk text input (enhanced version supporting multiple formats)
 * Supports formats:
 * - CSV: "Team Name, TAG, country, Group, players"
 * - Natural: "Team Paradoks [PD] 🇸🇪 - player1, player2, player3"
 * - Simple: "Team Name"
 */
export function parseTeamsFromBulkText(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const teams = [];

  lines.forEach((line, idx) => {
    const team = parseSingleTeamLine(line, idx);
    if (team) teams.push(team);
  });

  return teams;
}

/**
 * Parse a single line of team data - supports multiple formats
 */
function parseSingleTeamLine(line, index = 0) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Try CSV format first: "Name, TAG, country, Group, players"
  if (trimmed.includes(',')) {
    return parseCSVLine(trimmed, index);
  }

  // Try natural format: "Team Name [TAG] 🇸🇪 - players" or "Team Name (TAG) Country: players"
  const naturalMatch = trimmed.match(/^([^[\(]+)[\[\(]([^\]\)]+)[\]\)]?\s*([🇦-🇿]{2})?\s*[-:–]?\s*(.*)$/);
  if (naturalMatch) {
    const [, name, tag, flag, players] = naturalMatch;
    return {
      id: `temp-${Date.now()}-${index}`,
      name: name.trim(),
      tag: tag.trim(),
      country: flag ? extractCountryFromFlag(flag) : '',
      group: '',
      players: players.trim(),
    };
  }

  // Fallback: treat entire line as team name
  return {
    id: `temp-${Date.now()}-${index}`,
    name: trimmed,
    tag: generateTagFromName(trimmed),
    country: '',
    group: '',
    players: '',
  };
}

/**
 * Parse CSV format line: "Name, TAG, country, Group, players"
 */
function parseCSVLine(line, index = 0) {
  const parts = line.split(',').map(p => p.trim());
  const name = parts[0] || '';
  const tag = parts[1] || generateTagFromName(name);
  const country = (parts[2] || '').toLowerCase();
  const group = (parts[3] || '').toUpperCase();
  const players = parts[4] || '';

  return {
    id: `temp-${Date.now()}-${index}`,
    name,
    tag,
    country,
    group,
    players,
  };
}

/**
 * Parse teams from CSV file content
 */
export function parseTeamsFromCSV(csvText) {
  const lines = csvText.split('\n').filter(l => l.trim());

  // Check if first line is a header
  const firstLine = lines[0]?.toLowerCase();
  const hasHeader = firstLine?.includes('name') || firstLine?.includes('team');
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines.map((line, idx) => parseCSVLine(line, idx)).filter(Boolean);
}

/**
 * Parse teams from JSON (array of team objects or full tournament structure)
 */
export function parseTeamsFromJSON(jsonData) {
  try {
    const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;

    // If it's an array, assume it's team objects
    if (Array.isArray(data)) {
      return data.map((team, idx) => normalizeTeamObject(team, idx));
    }

    // If it's a division object with teams array
    if (data.teams && Array.isArray(data.teams)) {
      return data.teams.map((team, idx) => normalizeTeamObject(team, idx));
    }

    // If it's a full tournament object, extract first division's teams
    if (data.divisions && Array.isArray(data.divisions) && data.divisions[0]?.teams) {
      return data.divisions[0].teams.map((team, idx) => normalizeTeamObject(team, idx));
    }

    return [];
  } catch (error) {
    console.error('JSON parse error:', error);
    return [];
  }
}

/**
 * Normalize a team object to ensure all required fields exist
 */
function normalizeTeamObject(team, index = 0) {
  // Handle both string array format and object format for players
  let playersString = '';
  if (typeof team.players === 'string') {
    playersString = team.players;
  } else if (Array.isArray(team.players)) {
    playersString = team.players.join(', ');
  }

  return {
    id: team.id || `temp-${Date.now()}-${index}`,
    name: team.name || '',
    tag: team.tag || generateTagFromName(team.name || ''),
    country: (team.country || '').toLowerCase(),
    group: team.group || '',
    players: playersString,
  };
}

/**
 * Validate teams and return validation results
 */
export function validateTeams(teams, existingTeams = [], availableGroups = []) {
  const validatedTeams = teams.map(team => {
    const errors = [];
    const warnings = [];

    // Required field validation
    if (!team.name || !team.name.trim()) {
      errors.push('Team name is required');
    }

    // Tag validation
    if (!team.tag || !team.tag.trim()) {
      warnings.push('Tag will be auto-generated');
    }

    // Group validation
    if (team.group && !availableGroups.includes(team.group)) {
      errors.push(`Invalid group "${team.group}". Available: ${availableGroups.join(', ')}`);
    }

    // Country code validation (should be 2 letters)
    if (team.country && team.country.length !== 2) {
      warnings.push('Country code should be 2 letters (e.g., "se", "fi")');
    }

    return {
      ...team,
      errors,
      warnings,
      isValid: errors.length === 0,
    };
  });

  // Check for duplicates within the import batch
  const namesSeen = new Map();
  const tagsSeen = new Map();

  validatedTeams.forEach((team, idx) => {
    const lowerName = team.name?.toLowerCase();
    const lowerTag = team.tag?.toLowerCase();

    if (lowerName) {
      if (namesSeen.has(lowerName)) {
        team.errors.push(`Duplicate name (also on line ${namesSeen.get(lowerName) + 1})`);
        team.isValid = false;
      } else {
        namesSeen.set(lowerName, idx);
      }
    }

    if (lowerTag) {
      if (tagsSeen.has(lowerTag)) {
        team.warnings.push(`Duplicate tag (also on line ${tagsSeen.get(lowerTag) + 1})`);
      } else {
        tagsSeen.set(lowerTag, idx);
      }
    }
  });

  return validatedTeams;
}

/**
 * Detect conflicts with existing teams
 */
export function detectDuplicates(newTeams, existingTeams) {
  const existingNames = new Set(existingTeams.map(t => t.name.toLowerCase()));
  const existingTags = new Set(existingTeams.map(t => t.tag?.toLowerCase()).filter(Boolean));

  return newTeams.map(team => {
    const conflicts = [];

    if (existingNames.has(team.name?.toLowerCase())) {
      conflicts.push('name');
    }

    if (team.tag && existingTags.has(team.tag.toLowerCase())) {
      conflicts.push('tag');
    }

    return {
      ...team,
      conflicts,
      hasConflict: conflicts.length > 0,
    };
  });
}

/**
 * Generate a tag from team name (first 2-4 chars, uppercase)
 */
function generateTagFromName(name) {
  if (!name) return '';

  // Remove common prefixes
  const cleaned = name.replace(/^(team|clan)\s+/i, '').trim();

  // Take first word or first 4 chars
  const firstWord = cleaned.split(/\s+/)[0];
  const tag = firstWord.substring(0, Math.min(4, firstWord.length));

  return tag.toUpperCase();
}

/**
 * Extract country code from flag emoji
 */
function extractCountryFromFlag(flag) {
  // Flag emojis are regional indicator symbols
  // 🇸🇪 = U+1F1F8 U+1F1EA (SE)
  const codePoints = [...flag].map(char => char.codePointAt(0));

  if (codePoints.length >= 2 && codePoints[0] >= 0x1F1E6 && codePoints[0] <= 0x1F1FF) {
    const first = String.fromCharCode(codePoints[0] - 0x1F1E6 + 65);
    const second = String.fromCharCode(codePoints[1] - 0x1F1E6 + 65);
    return (first + second).toLowerCase();
  }

  return '';
}

/**
 * Count summary statistics for validated teams
 */
export function getImportSummary(validatedTeams) {
  return {
    total: validatedTeams.length,
    valid: validatedTeams.filter(t => t.isValid).length,
    errors: validatedTeams.filter(t => !t.isValid).length,
    warnings: validatedTeams.filter(t => t.warnings?.length > 0).length,
    conflicts: validatedTeams.filter(t => t.hasConflict).length,
  };
}
