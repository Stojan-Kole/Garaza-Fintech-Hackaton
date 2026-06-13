"""
Download and parse the OFAC Specially Designated Nationals (SDN) list.

Public domain data: https://ofac.treasury.gov/downloads/sdn.xml
Schema namespace: http://tempuri.org/sdnList.xsd
"""

import xml.etree.ElementTree as ET
import requests
from pathlib import Path
from dataclasses import dataclass, field

SDN_URL = "https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.XML"
_NS = "https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/XML"
_CACHE = Path(".cache/sdn.xml")


@dataclass
class SanctionedEntity:
    uid: str
    name: str                              # primary canonical name
    all_names: list[str]                   # primary + all aliases
    entity_type: str                       # Individual / Entity / Vessel / Aircraft
    programs: list[str]                    # IRAN, UKRAINE-EO13685, etc.
    countries: list[str]
    crypto_addresses: dict[str, list[str]] # {"XBT": ["1abc..."], "ETH": [...]}


def _t(local: str) -> str:
    return f"{{{_NS}}}{local}"


def _text(elem: ET.Element, local: str) -> str:
    child = elem.find(_t(local))
    return (child.text or "").strip() if child is not None else ""


def download(force: bool = False) -> Path:
    _CACHE.parent.mkdir(parents=True, exist_ok=True)
    if _CACHE.exists() and not force:
        return _CACHE
    print(f"Downloading OFAC SDN list from {SDN_URL} ...")
    r = requests.get(SDN_URL, timeout=120, stream=True)
    r.raise_for_status()
    with _CACHE.open("wb") as fh:
        for chunk in r.iter_content(65_536):
            fh.write(chunk)
    size_mb = _CACHE.stat().st_size / 1_048_576
    print(f"Saved {size_mb:.1f} MB to {_CACHE}")
    return _CACHE


def parse(path: Path) -> list[SanctionedEntity]:
    tree = ET.parse(path)
    root = tree.getroot()
    entities: list[SanctionedEntity] = []

    for entry in root.findall(_t("sdnEntry")):
        uid = _text(entry, "uid")
        first = _text(entry, "firstName")
        last = _text(entry, "lastName")
        etype = _text(entry, "sdnType")

        primary = f"{first} {last}".strip() if first else last
        all_names: list[str] = [primary] if primary else []

        # Aliases
        aka_list = entry.find(_t("akaList"))
        if aka_list is not None:
            for aka in aka_list.findall(_t("aka")):
                af = _text(aka, "firstName")
                al = _text(aka, "lastName")
                alias = f"{af} {al}".strip() if af else al
                if alias and alias not in all_names:
                    all_names.append(alias)

        # Countries (from address list)
        countries: list[str] = []
        addr_list = entry.find(_t("addressList"))
        if addr_list is not None:
            for addr in addr_list.findall(_t("address")):
                c = _text(addr, "country")
                if c and c not in countries:
                    countries.append(c)

        # Sanctions programs
        programs: list[str] = []
        prog_list = entry.find(_t("programList"))
        if prog_list is not None:
            for prog in prog_list.findall(_t("program")):
                if prog.text:
                    programs.append(prog.text.strip())

        # Crypto addresses
        # idType examples: "Digital Currency Address - XBT", "Digital Currency Address - ETH"
        crypto: dict[str, list[str]] = {}
        id_list = entry.find(_t("idList"))
        if id_list is not None:
            for id_elem in id_list.findall(_t("id")):
                id_type = _text(id_elem, "idType")
                id_num = _text(id_elem, "idNumber")
                if "Digital Currency Address" in id_type and id_num:
                    currency = id_type.split(" - ")[-1] if " - " in id_type else "UNK"
                    crypto.setdefault(currency, []).append(id_num.strip())

        if all_names or crypto:
            entities.append(SanctionedEntity(
                uid=uid,
                name=primary,
                all_names=all_names,
                entity_type=etype,
                programs=programs,
                countries=countries,
                crypto_addresses=crypto,
            ))

    return entities
