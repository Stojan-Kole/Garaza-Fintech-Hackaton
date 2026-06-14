"""
Feature extraction for temporal risk prediction.
All expensive metrics are precomputed in GraphMetrics for O(1) lookup.
"""
from __future__ import annotations
import networkx as nx
from jellyfish import jaro_winkler_similarity
from .data_generator import YearSnapshot, HIGH_RISK_COUNTRIES
from .graph import GraphMetrics, MAX_PATH_DIST

FEATURE_NAMES = [
    "alias_count",
    "name_sim_to_blacklist",
    "graph_degree",
    "betweenness_centrality",
    "shortest_path_to_blacklisted",
    "blacklisted_neighbors",
    "paths_to_blacklisted",
    "owned_companies_count",
    "ownership_chain_depth",
    "ownership_changes_last_year",
    "new_connections_last_year",
    "ownership_growth_rate",
    "structure_change_rate",
    "direct_blacklist_exposure",
    "indirect_blacklist_exposure",
    "propagated_graph_risk",
    "high_risk_country",
]

# Human-readable explanation for each feature when elevated
FEATURE_EXPLANATIONS = {
    "shortest_path_to_blacklisted": "High ownership proximity to sanctioned entities",
    "blacklisted_neighbors": "Direct connections to sanctioned entities",
    "paths_to_blacklisted": "Multiple paths leading to sanctioned entities",
    "propagated_graph_risk": "Risk propagated through the ownership network",
    "indirect_blacklist_exposure": "Directly connected to a sanctioned entity",
    "direct_blacklist_exposure": "Entity appears on a sanctions list",
    "betweenness_centrality": "Acts as key intermediary in ownership network",
    "graph_degree": "High number of ownership connections",
    "ownership_changes_last_year": "Multiple ownership structure changes detected",
    "new_connections_last_year": "Rapid acquisition of new network connections",
    "ownership_growth_rate": "Rapid increase in number of owned companies",
    "structure_change_rate": "Significant restructuring of ownership positions",
    "owned_companies_count": "Controls a large number of companies",
    "ownership_chain_depth": "Deep multi-layer ownership chain structure",
    "name_sim_to_blacklist": "Name closely resembles known sanctioned entities",
    "alias_count": "Entity has multiple registered aliases",
    "high_risk_country": "Associated with a high-risk jurisdiction",
}


def _name_sim_to_blacklist(entity_name: str, snapshot: YearSnapshot) -> float:
    """Max jaro-winkler similarity against all blacklisted entity names."""
    bl_names = []
    for p in snapshot.persons:
        if p.id in snapshot.blacklist:
            bl_names.append(p.name.lower())
    for c in snapshot.companies:
        if c.id in snapshot.blacklist:
            bl_names.append(c.name.lower())
    if not bl_names:
        return 0.0
    name_lower = entity_name.lower()
    # Sample at most 80 to keep this fast
    sample = bl_names[:80]
    return max(jaro_winkler_similarity(name_lower, bl) for bl in sample)


def _propagated_risk(entity_id: str, metrics: GraphMetrics, blacklist: set) -> float:
    """Risk score based on distance-weighted blacklist proximity."""
    dist = metrics.dist_to_blacklist.get(entity_id, MAX_PATH_DIST)
    if entity_id in blacklist:
        return 1.0
    if dist >= MAX_PATH_DIST:
        return 0.0
    # Exponential decay: risk = e^(-dist + 1)
    import math
    return round(math.exp(-(dist - 1)), 4)


def _paths_to_blacklisted(entity_id: str, G: nx.DiGraph, blacklist: set,
                           metrics: GraphMetrics, cap: int = 15) -> int:
    """Approximate count: sum of paths via direct neighbors."""
    neighbors = metrics.undirected_adj.get(entity_id, set())
    count = 0
    for n in neighbors:
        if n in blacklist:
            count += 2  # direct connection = 2 paths counted
        else:
            # neighbor's blacklisted neighbors count as indirect paths
            count += metrics.bl_neighbor_count.get(n, 0)
        if count >= cap:
            return cap
    return min(count, cap)


def _ownership_chain_depth(entity_id: str, G: nx.DiGraph) -> int:
    if entity_id not in G or G.out_degree(entity_id) == 0:
        return 0
    try:
        lengths = nx.single_source_shortest_path_length(G, entity_id, cutoff=8)
        return max(lengths.values())
    except Exception:
        return 0


def extract_features(
    entity_id: str,
    entity_name: str,
    snapshot: YearSnapshot,
    G: nx.DiGraph,
    metrics: GraphMetrics,
    prev_snapshot: YearSnapshot | None,
    prev_metrics: GraphMetrics | None,
) -> list:
    blacklist = snapshot.blacklist

    # alias_count
    alias_count = 0
    nationality = None
    for p in snapshot.persons:
        if p.id == entity_id:
            alias_count = len(p.aliases)
            nationality = p.nationality
            break
    entity_country = None
    for c in snapshot.companies:
        if c.id == entity_id:
            entity_country = c.country
            break

    # name_sim_to_blacklist
    name_sim = _name_sim_to_blacklist(entity_name, snapshot)

    # graph_degree
    neighbors = metrics.undirected_adj.get(entity_id, set())
    degree = len(neighbors)

    # betweenness_centrality
    betweenness = metrics.betweenness.get(entity_id, 0.0)

    # shortest_path_to_blacklisted
    shortest_path = metrics.dist_to_blacklist.get(entity_id, MAX_PATH_DIST)

    # blacklisted_neighbors
    bl_neighbors = metrics.bl_neighbor_count.get(entity_id, 0)

    # paths_to_blacklisted
    paths_count = _paths_to_blacklisted(entity_id, G, blacklist, metrics)

    # owned_companies_count (out-edges = entities this node owns)
    owned_count = G.out_degree(entity_id) if entity_id in G else 0

    # ownership_chain_depth
    chain_depth = _ownership_chain_depth(entity_id, G)

    # ownership_changes_last_year
    curr_owned = {o.target_id for o in snapshot.ownerships if o.owner_id == entity_id}
    if prev_snapshot is not None:
        prev_owned = {o.target_id for o in prev_snapshot.ownerships if o.owner_id == entity_id}
        changes = len(curr_owned.symmetric_difference(prev_owned))
    else:
        changes = 0

    # new_connections_last_year
    if prev_metrics is not None:
        prev_neighbors = prev_metrics.undirected_adj.get(entity_id, set())
        new_connections = len(neighbors - prev_neighbors)
    else:
        new_connections = degree

    # ownership_growth_rate
    prev_owned_count = len({o.target_id for o in prev_snapshot.ownerships if o.owner_id == entity_id}) if prev_snapshot else 0
    if prev_owned_count > 0:
        growth_rate = (owned_count - prev_owned_count) / prev_owned_count
    else:
        growth_rate = float(min(owned_count, 5))

    # structure_change_rate
    total_ownerships = max(1, len(snapshot.ownerships))
    structure_change_rate = changes / total_ownerships

    # direct_blacklist_exposure
    direct_exposure = 1.0 if entity_id in blacklist else 0.0

    # indirect_blacklist_exposure
    indirect_exposure = 1.0 if bl_neighbors > 0 else 0.0

    # propagated_graph_risk
    prop_risk = _propagated_risk(entity_id, metrics, blacklist)

    # high_risk_country
    hr_country = nationality or entity_country or ""
    high_risk = 1.0 if hr_country in HIGH_RISK_COUNTRIES else 0.0

    return [
        float(alias_count),
        float(name_sim),
        float(degree),
        float(betweenness),
        float(shortest_path),
        float(bl_neighbors),
        float(paths_count),
        float(owned_count),
        float(chain_depth),
        float(changes),
        float(new_connections),
        float(growth_rate),
        float(structure_change_rate),
        float(direct_exposure),
        float(indirect_exposure),
        float(prop_risk),
        float(high_risk),
    ]
