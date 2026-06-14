"""
Synthetic temporal dataset generator.
Produces 1000 persons + 500 companies across 11 years (2016-2026).
"""
from __future__ import annotations
import random
from dataclasses import dataclass, field

YEARS = list(range(2016, 2027))
N_PERSONS = 1000
N_COMPANIES = 500
SEED = 42

FIRST_NAMES = [
    "Alexander", "Nikolai", "Dmitri", "Ivan", "Sergei", "Viktor", "Andrei",
    "Vladimir", "Mikhail", "Boris", "Pavel", "Konstantin", "Alexei", "Roman",
    "Mohammad", "Ahmed", "Hassan", "Ali", "Omar", "Yusuf", "Ibrahim", "Khalid",
    "Wei", "Jian", "Ming", "Hui", "Chen", "Li", "Zhang", "Wang",
    "John", "James", "Robert", "Michael", "William", "David", "Richard", "Thomas",
    "Jean", "Pierre", "Henri", "Michel", "Andre", "Laurent", "Carlos", "Juan",
    "Miguel", "Pedro", "Luis", "Jorge", "Roberto", "Marko", "Stefan", "Nikola",
    "Dragan", "Branko", "Zoran", "Milos", "Tariq", "Faisal", "Samir", "Reza",
]

LAST_NAMES = [
    "Ivanov", "Petrov", "Sidorov", "Volkov", "Kozlov", "Novikov", "Morozov",
    "Popov", "Sokolov", "Lebedev", "Kovalev", "Orlov", "Fedorov", "Makarov",
    "Al-Rashid", "Al-Hassan", "Al-Farsi", "Al-Khalid", "Mansour", "Nasser",
    "Wang", "Li", "Zhang", "Chen", "Liu", "Yang", "Huang", "Zhao",
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Davis", "Miller",
    "Dupont", "Martin", "Bernard", "Thomas", "Robert", "Richard", "Petit",
    "Garcia", "Martinez", "Lopez", "Gonzalez", "Rodriguez", "Hernandez",
    "Nikolic", "Jovanovic", "Petrovic", "Popovic", "Djordjevic", "Stankovic",
    "Ahmadi", "Hosseini", "Khalil", "Okonkwo", "Dlamini", "Fernandez",
]

COUNTRIES = [
    "RU", "IR", "KP", "SY", "BY", "VE", "CU", "MM", "SD",
    "DE", "FR", "GB", "US", "IT", "ES", "CN", "JP", "KR", "BR",
    "AE", "SA", "TR", "IN", "PK", "NG", "ZA", "MX", "CA", "AU",
]
HIGH_RISK_COUNTRIES = {"RU", "IR", "KP", "SY", "BY", "VE", "CU", "MM", "SD"}

INDUSTRIES = [
    "energy", "finance", "mining", "shipping", "real_estate",
    "construction", "trade", "logistics", "technology", "agriculture",
]

COMPANY_PREFIXES = [
    "Global", "Eastern", "Northern", "Pacific", "Atlantic", "United", "Premier",
    "Apex", "Zenith", "Horizon", "Summit", "Delta", "Alpha", "Omega", "Prime",
    "Continental", "Imperial", "Royal", "National", "Strategic", "Allied",
    "Meridian", "Caspian", "Black Sea", "Arctic", "Eurasian", "Trans",
]
COMPANY_SUFFIXES = [
    "Ltd", "LLC", "Corp", "Holdings", "Group", "International",
    "Enterprises", "Partners", "Capital", "Ventures", "Resources", "Trading",
]


@dataclass
class Person:
    id: str
    name: str
    aliases: list
    nationality: str


@dataclass
class Company:
    id: str
    name: str
    industry: str
    country: str
    is_shell: bool


@dataclass
class Ownership:
    owner_id: str
    target_id: str
    percentage: float


@dataclass
class YearSnapshot:
    year: int
    persons: list
    companies: list
    ownerships: list
    blacklist: set


def _gen_alias(name: str, rng: random.Random) -> str:
    transforms = [
        lambda s: s.replace("ei", "ay").replace("ov", "off"),
        lambda s: s.replace("v", "w").replace("j", "y"),
        lambda s: s.replace("sz", "sh").replace("cz", "ts"),
        lambda s: s.replace("ov", "ow").replace("ev", "ef"),
        lambda s: s.replace("i", "y").replace("k", "c"),
    ]
    t = rng.choice(transforms)
    return t(name)


def generate_dataset() -> dict:
    rng = random.Random(SEED)

    persons = []
    for i in range(N_PERSONS):
        first = rng.choice(FIRST_NAMES)
        last = rng.choice(LAST_NAMES)
        name = f"{first} {last}"
        nationality = rng.choice(COUNTRIES)
        n_aliases = rng.randint(0, 3)
        aliases = [_gen_alias(name, rng) for _ in range(n_aliases)]
        persons.append(Person(id=f"P{i:04d}", name=name, aliases=aliases, nationality=nationality))

    companies = []
    for i in range(N_COMPANIES):
        prefix = rng.choice(COMPANY_PREFIXES)
        suffix = rng.choice(COMPANY_SUFFIXES)
        word = rng.choice(LAST_NAMES)
        name = f"{prefix} {word} {suffix}"
        industry = rng.choice(INDUSTRIES)
        country = rng.choice(COUNTRIES)
        is_shell = rng.random() < 0.25
        companies.append(Company(
            id=f"C{i:03d}", name=name, industry=industry,
            country=country, is_shell=is_shell,
        ))

    all_entity_ids = [p.id for p in persons] + [c.id for c in companies]
    company_ids = [c.id for c in companies]

    # ~12% of entities eventually get blacklisted
    n_to_blacklist = int(len(all_entity_ids) * 0.12)
    blacklist_targets = rng.sample(all_entity_ids, n_to_blacklist)
    blacklist_year: dict = {}
    for eid in blacklist_targets:
        blacklist_year[eid] = rng.randint(2018, 2026)

    # Base ownership structure
    base_ownerships = []
    for c in companies:
        n_owners = rng.randint(1, 3)
        pool = [
            p for p in persons if p.nationality in HIGH_RISK_COUNTRIES
        ] if c.is_shell else persons
        pool = pool or persons
        owners_sample = rng.sample(pool, min(n_owners, len(pool)))
        remaining = 100.0
        for j, owner in enumerate(owners_sample):
            if j == len(owners_sample) - 1:
                pct = remaining
            else:
                pct = round(rng.uniform(10, max(10.1, remaining - 10 * (len(owners_sample) - j - 1))), 1)
                remaining -= pct
            base_ownerships.append(Ownership(owner.id, c.id, max(0.1, pct)))

    # Some companies own other companies (~20% holding structures)
    holding_targets = rng.sample(company_ids, int(len(company_ids) * 0.20))
    for target_id in holding_targets:
        owner_company = rng.choice([c for c in companies if c.id != target_id])
        pct = round(rng.uniform(30, 100), 1)
        base_ownerships.append(Ownership(owner_company.id, target_id, pct))

    snapshots: dict = {}
    cumulative_blacklist: set = set()
    current_ownerships = list(base_ownerships)

    for year in YEARS:
        for eid, bl_year in blacklist_year.items():
            if year >= bl_year:
                cumulative_blacklist.add(eid)

        new_ownerships = list(current_ownerships)

        # Pre-blacklist pattern: 1-2 years before blacklisting, gain connections to already-blacklisted
        for eid, bl_year in blacklist_year.items():
            years_until = bl_year - year
            if 0 < years_until <= 2 and eid.startswith("P"):
                bl_companies = [c.id for c in companies if c.id in cumulative_blacklist]
                if bl_companies:
                    target = rng.choice(bl_companies[:min(5, len(bl_companies))])
                    pct = round(rng.uniform(10, 40), 1)
                    new_ownerships = [
                        o for o in new_ownerships
                        if not (o.owner_id == eid and o.target_id == target)
                    ]
                    new_ownerships.append(Ownership(eid, target, pct))

        # ~3% random churn
        n_changes = max(1, int(len(new_ownerships) * 0.03))
        for _ in range(n_changes):
            if not new_ownerships:
                break
            action = rng.choice(["adjust", "remove", "add"])
            if action == "adjust":
                idx = rng.randint(0, len(new_ownerships) - 1)
                o = new_ownerships[idx]
                new_pct = max(1.0, min(100.0, o.percentage + rng.uniform(-10, 10)))
                new_ownerships[idx] = Ownership(o.owner_id, o.target_id, round(new_pct, 1))
            elif action == "remove" and len(new_ownerships) > 1:
                idx = rng.randint(0, len(new_ownerships) - 1)
                new_ownerships.pop(idx)
            else:
                owner = rng.choice(persons)
                target_c = rng.choice(companies)
                pct = round(rng.uniform(10, 50), 1)
                new_ownerships.append(Ownership(owner.id, target_c.id, pct))

        current_ownerships = new_ownerships
        snapshots[year] = YearSnapshot(
            year=year,
            persons=persons,
            companies=companies,
            ownerships=list(current_ownerships),
            blacklist=set(cumulative_blacklist),
        )

    return snapshots
