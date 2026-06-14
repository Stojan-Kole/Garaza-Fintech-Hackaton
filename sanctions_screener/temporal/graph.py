"""
Temporal graph construction and metric precomputation.
Builds NetworkX directed graphs per year with cached metrics for fast feature lookup.
"""
from __future__ import annotations
from dataclasses import dataclass, field
import networkx as nx
from .data_generator import YearSnapshot

MAX_PATH_DIST = 10.0


@dataclass
class GraphMetrics:
    betweenness: dict          # node_id -> float
    dist_to_blacklist: dict    # node_id -> float (MAX_PATH_DIST if unreachable)
    bl_neighbor_count: dict    # node_id -> int
    undirected_adj: dict       # node_id -> set of neighbor ids


def build_year_graph(snapshot: YearSnapshot) -> nx.DiGraph:
    G = nx.DiGraph()
    for p in snapshot.persons:
        G.add_node(p.id, entity_type="person", name=p.name,
                   nationality=p.nationality, blacklisted=p.id in snapshot.blacklist)
    for c in snapshot.companies:
        G.add_node(c.id, entity_type="company", name=c.name,
                   country=c.country, is_shell=c.is_shell,
                   blacklisted=c.id in snapshot.blacklist)
    for o in snapshot.ownerships:
        if G.has_node(o.owner_id) and G.has_node(o.target_id):
            G.add_edge(o.owner_id, o.target_id, percentage=o.percentage)
    return G


def compute_metrics(G: nx.DiGraph, snapshot: YearSnapshot) -> GraphMetrics:
    undirected = G.to_undirected()
    blacklist = snapshot.blacklist

    # Betweenness centrality — approximate with k=30 pivots
    try:
        bc = nx.betweenness_centrality(undirected, k=min(30, undirected.number_of_nodes()), normalized=True)
    except Exception:
        bc = {n: 0.0 for n in G.nodes()}

    # Multi-source BFS from all blacklisted nodes — gives shortest distance to any blacklisted entity
    bl_sources = [n for n in blacklist if n in undirected]
    if bl_sources:
        raw_lengths = dict(nx.multi_source_dijkstra_path_length(undirected, bl_sources))
        dist_to_bl = {n: float(raw_lengths.get(n, MAX_PATH_DIST)) for n in G.nodes()}
    else:
        dist_to_bl = {n: MAX_PATH_DIST for n in G.nodes()}

    # Blacklisted neighbor count
    undirected_adj = {}
    bl_neighbor_count = {}
    for node in G.nodes():
        neighbors = set(undirected.neighbors(node))
        undirected_adj[node] = neighbors
        bl_neighbor_count[node] = sum(1 for n in neighbors if n in blacklist)

    return GraphMetrics(
        betweenness=bc,
        dist_to_blacklist=dist_to_bl,
        bl_neighbor_count=bl_neighbor_count,
        undirected_adj=undirected_adj,
    )


def build_temporal_graphs(snapshots: dict) -> tuple:
    """Returns (graphs dict, metrics dict)."""
    graphs = {}
    metrics = {}
    for year, snap in snapshots.items():
        G = build_year_graph(snap)
        graphs[year] = G
        metrics[year] = compute_metrics(G, snap)
    return graphs, metrics
