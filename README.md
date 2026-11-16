# Záloha dat časové osy

Tahle větev neobsahuje kód, jen denní kopii databáze.

- `data.json` — všechny tabulky jako syrové řádky. Mění se jen tehdy, když se změní data.
- `stav.json` — kdy záloha naposledy proběhla a kolik řádků která tabulka měla.

Historie větve je historie dat den po dni. Zálohu dělá úloha
`.github/workflows/zaloha.yml` z hlavní větve, každou noc kolem 3:17 UTC.

**Obnova:** vybrat commit z požadovaného dne, vzít z něj `data.json` a řádky
nahrát zpět do Supabase podle `id` (upsert). Nejdřív `categories` a `tags`,
potom `events`, nakonec tabulky osob a vazeb.

První snímek (16. 11. 2026) vznikl ručně před zavedením osob a rodokmenu.
