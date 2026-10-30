# image-finder

**Un agent qui trouve des images libres de droits sur le web, avec licence et attribution, pour Claude Code et Codex.**

Décrivez l'image voulue : l'agent cherche sur Openverse, Wikimedia Commons, NASA (et Pexels, Unsplash, Pixabay avec une clé), filtre par licence, taille et orientation, vérifie que les URL sont valides, fournit la ligne de crédit à coller et télécharge l'image choisie.

Agent open source de recherche d'images sur le web, installable dans **Claude Code** et **Codex**.
Un serveur MCP (Node ≥ 18, **zéro dépendance**) + un CLI + un agent/skill Claude + des instructions `AGENTS.md` pour Codex.

*Open-source web image search agent for Claude Code and Codex: MCP server + CLI, license filtering, attribution, safe download.*

## Sources

| Provider | Clé requise | Licences |
|---|---|---|
| Openverse | non | CC, domaine public (800 M+ œuvres) |
| Wikimedia Commons | non | CC / domaine public |
| NASA Image Library | non | domaine public |
| Pexels | `PEXELS_API_KEY` | Pexels License |
| Unsplash | `UNSPLASH_ACCESS_KEY` | Unsplash License |
| Pixabay | `PIXABAY_API_KEY` | Pixabay License |

Les providers à clé s'activent automatiquement dès que la variable d'environnement existe (clés gratuites).

## Outils MCP

- `search_images` : recherche parallèle multi-sources, filtres `license` (`any|commercial|modifiable|public-domain`), `orientation`, `minWidth/minHeight`, déduplication, résultats entrelacés, ligne d'attribution prête à coller.
- `inspect_image` : vérifie qu'une URL est vivante, type, poids et dimensions réelles.
- `download_image` : télécharge dans un dossier (max 30 Mo, uniquement `image/*`, protection SSRF : refuse localhost/IP privées, y compris via redirections).
- `list_providers` : providers actifs.

## Install

```
npx skills add arnoldkouya/image-finder -g
```

`-g` installe pour tous les projets ; sans lui, l'installation se fait dans le projet courant. Node 18 ou plus récent requis. Aucune dépendance à installer.

| Harness | Installé dans | Invocation |
| --- | --- | --- |
| Claude Code | `~/.claude/skills/image-search` | `/image-search <sujet>` ou décrivez votre besoin |
| Codex CLI | `~/.agents/skills/image-search` | `$image-search <sujet>` ou décrivez votre besoin |
| Cursor / OpenCode | retrouvent les copies ci-dessus | idem |

Le skill embarque le CLI (`scripts/cli.js`) : l'agent s'en sert directement. Pour exposer en plus les outils MCP (`search_images`, `inspect_image`, `download_image`, `list_providers`), voir ci-dessous.

- **Un seul harness :** `npx skills add arnoldkouya/image-finder -g --agent claude-code` (ou `codex`, `opencode`, `cursor`).
- **Plugin Claude Code** (agent `image-finder`, skill, commande, serveur MCP) : `/plugin marketplace add arnoldkouya/image-finder`, puis `/plugin install image-finder@image-finder` (commande : `/image-finder:find-images`).
- **MCP dans Claude Code :** `claude mcp add --scope user image-finder -- npx -y -p github:arnoldkouya/image-finder image-finder-mcp`
- **MCP dans Codex :** `codex mcp add image-finder -- npx -y -p github:arnoldkouya/image-finder image-finder-mcp`
- **Depuis un clone :** `scripts/install-claude.sh [--plugin|--mcp]` et `scripts/install-codex.sh` (MCP + consignes `AGENTS.md`).
- **Clés optionnelles :** `export PEXELS_API_KEY=… UNSPLASH_ACCESS_KEY=… PIXABAY_API_KEY=…` avant de lancer l'agent (pour Codex : section `env` de `[mcp_servers.image-finder]`, voir `codex/config.toml.example`).
- **Si le skill ne se déclenche pas seul,** nommez-le : *utilise image-search pour trouver…*.

Exemple : « trouve 5 photos CC0 d'un renard roux en paysage, ≥ 1600 px, et télécharge la meilleure ».

## CLI

```bash
node skills/image-search/scripts/cli.js search "red fox" --license commercial --orientation landscape --min-width 1600 --limit 10
node skills/image-search/scripts/cli.js download <url> --dir ./images --name fox
node skills/image-search/scripts/cli.js inspect <url>
node skills/image-search/scripts/cli.js providers
```

## Notes

- Les licences sont celles déclarées par les sources ; vérifiez la page d'origine pour un usage critique. `commercial` exclut NC ; `modifiable` exclut aussi ND ; CC BY/BY-SA exigent l'attribution (fournie).
- Personnes identifiables, logos, marques : droits supplémentaires possibles.
- Derrière un proxy, Node ≥ 22.21 : `NODE_USE_ENV_PROXY=1`.
- Tests : `npm test` (réseau simulé). Les appels aux vraies API n'ont pas pu être exécutés dans l'environnement de développement (hôtes bloqués) : faites un premier `node skills/image-search/scripts/cli.js search "fox"` pour confirmer chez vous.

## Licence

MIT
