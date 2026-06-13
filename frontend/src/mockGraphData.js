// Deterministic seeded-random graph builder — produces the same graph for the
// same entity UID every time, so the UI is stable across re-renders.

const COMPANY_PREFIXES = [
  'Pacific', 'Eastern', 'Global', 'Atlantic', 'International',
  'Continental', 'Trans-', 'Euro-', 'United', 'Sovereign',
]
const COMPANY_TYPES = [
  'Holdings Ltd', 'Investments LLC', 'Trading Co', 'Capital Group',
  'Ventures Inc', 'Resources Corp', 'Finance Ltd', 'Enterprise Group',
]
const PERSON_FIRSTS = [
  'Alexander', 'Viktor', 'Mikhail', 'Boris', 'Andrei',
  'Hassan', 'Ahmad', 'Mohammed', 'Sergei', 'Pavel',
]
const PERSON_LASTS = [
  'Petrov', 'Volkov', 'Sokolov', 'Al-Rashid', 'Karimov',
  'Nazarov', 'Yilmaz', 'Rodriguez', 'Chen', 'Park',
]
const ADDRESSES_BY_COUNTRY = {
  Russia: ['ul. Tverskaya 12, Moscow', 'Nevsky Prospekt 88, St. Petersburg'],
  Iran:   ['Valiasr St., Block 7, Tehran', 'North Kargar Ave., Tehran'],
  China:  ['No. 18 Jianguomen Ave., Beijing', '1 Century Blvd., Shanghai'],
  Cuba:   ['Calle Obispo 34, Havana', 'Av. de los Presidentes, Havana'],
  Syria:  ['Al-Hamra Quarter, Damascus', 'Bab Touma St., Damascus'],
  default: [
    'Suite 200, 47 Trust Lane', '12 Corporate Drive, Floor 3',
    'PO Box 4821, Offshore House', 'Unit 5, Freedom Plaza',
  ],
}

function djb2(str) {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = (((hash << 5) + hash) + str.charCodeAt(i)) >>> 0
  }
  return hash
}

function seededRng(seed) {
  let s = (seed ^ 0x9e3779b9) >>> 0 || 1
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5
    return ((s >>> 0) / 0xFFFFFFFF)
  }
}

function pick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)]
}

function shorten(str, max = 22) {
  return str.length > max ? str.slice(0, max - 1) + '…' : str
}

function companyName(rng) {
  return `${pick(COMPANY_PREFIXES, rng)} ${pick(COMPANY_TYPES, rng)}`
}

function personName(rng) {
  return `${pick(PERSON_FIRSTS, rng)} ${pick(PERSON_LASTS, rng)}`
}

function address(country, rng) {
  const pool = ADDRESSES_BY_COUNTRY[country] || ADDRESSES_BY_COUNTRY.default
  return pick(pool, rng)
}

/**
 * Generate a realistic-looking entity relationship graph for a sanctioned entity.
 * When the backend `/graph/entity/{uid}` endpoint exists, this is used as fallback only.
 */
export function generateMockGraph(entity) {
  const seed   = djb2(entity.uid || entity.name || 'default')
  const rng    = seededRng(seed)
  const country = entity.countries?.[0] || 'Unknown'
  const isIndividual = entity.entity_type === 'Individual'

  const nodes = []
  const links = []

  // ── Focus node: the sanctioned entity ──────────────────────────────────────
  const focusId = `focus_${entity.uid}`
  nodes.push({
    id:          focusId,
    label:       entity.name,
    shortLabel:  shorten(entity.name, 20),
    type:        isIndividual ? 'individual' : 'company',
    sanctioned:  true,
    uid:         entity.uid,
    programs:    entity.programs || [],
    countries:   entity.countries || [],
    detail:      `OFAC SDN UID: ${entity.uid}`,
  })

  // ── Intermediate shell company (direct ownership link) ─────────────────────
  const shellAName = companyName(rng)
  const shellAId   = 'shell_a'
  nodes.push({
    id:          shellAId,
    label:       shellAName,
    shortLabel:  shorten(shellAName),
    type:        'company',
    sanctioned:  false,
    jurisdiction: country,
    detail:      `Registered in ${country}`,
    note:        'Intermediate holding vehicle',
  })
  links.push({ source: shellAId, target: focusId, type: 'owns', label: '51% ownership' })

  // ── Director of shell company ──────────────────────────────────────────────
  const dirName = personName(rng)
  const dirId   = 'director_a'
  nodes.push({
    id:        dirId,
    label:     dirName,
    shortLabel: dirName,
    type:      'individual',
    sanctioned: false,
    role:      'Director',
    detail:    `Director of ${shellAName}`,
  })
  links.push({ source: dirId, target: shellAId, type: 'directs', label: 'Director' })

  // ── Shared registered address ──────────────────────────────────────────────
  const addrLabel = address(country, rng)
  const addrId    = 'address_a'
  nodes.push({
    id:        addrId,
    label:     addrLabel,
    shortLabel: shorten(addrLabel),
    type:      'address',
    sanctioned: false,
    country,
    detail:    `${country} — shared by ${isIndividual ? 2 : 3} entities`,
  })
  links.push({ source: addrId, target: focusId,  type: 'registered_at', label: 'Reg. address' })
  links.push({ source: addrId, target: shellAId, type: 'registered_at', label: 'Reg. address' })

  // ── Ultimate beneficial owner (BVI) ───────────────────────────────────────
  const uboName = companyName(rng)
  const uboId   = 'ubo_a'
  nodes.push({
    id:          uboId,
    label:       uboName,
    shortLabel:  shorten(uboName),
    type:        'company',
    sanctioned:  false,
    jurisdiction: 'British Virgin Islands',
    detail:      'Ultimate Beneficial Owner — BVI registered',
    note:        'Offshore holding; no public registry',
  })
  links.push({ source: uboId, target: shellAId, type: 'beneficial_owner_of', label: '80% UBO' })

  // ── Person behind the UBO ─────────────────────────────────────────────────
  const ownerName = personName(rng)
  const ownerId   = 'owner_b'
  nodes.push({
    id:        ownerId,
    label:     ownerName,
    shortLabel: ownerName,
    type:      'individual',
    sanctioned: false,
    role:      'Beneficial Owner',
    detail:    `Beneficial owner of ${uboName}`,
  })
  links.push({ source: ownerId, target: uboId, type: 'beneficial_owner_of', label: '100% UBO' })

  // ── Crypto wallets (if the entity has any) ────────────────────────────────
  const cryptoEntries = Object.entries(entity.crypto_addresses || {})
  if (cryptoEntries.length > 0) {
    const [currency, addrs] = cryptoEntries[0]
    const addrStr = addrs?.[0] || ''
    const walletId = 'wallet_a'
    nodes.push({
      id:        walletId,
      label:     `${currency}: ${addrStr.slice(0, 12)}…`,
      shortLabel: `${currency} wallet`,
      type:      'wallet',
      sanctioned: false,
      currency,
      address:   addrStr,
      detail:    `${currency} address: ${addrStr}`,
    })
    links.push({ source: focusId, target: walletId, type: 'controls_wallet', label: `Controls ${currency}` })
    links.push({ source: dirId,   target: walletId, type: 'controls_wallet', label: 'Co-signatory' })
  }

  return {
    nodes,
    links,
    focus_node_id: focusId,
    connection_path: [ownerId, uboId, shellAId, focusId],
    connection_path_labels: ['100% UBO', '80% UBO', '51% ownership'],
    summary: {
      total_nodes:      nodes.length,
      total_edges:      links.length,
      sanctioned_count: 1,
      max_hops:         3,
      connection_type:  'ownership_chain',
    },
    is_mock: true,
  }
}
