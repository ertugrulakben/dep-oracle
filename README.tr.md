<p align="center">
  <h1 align="center">dep-oracle</h1>
  <p align="center"><strong>Prediktif Bagimlilik Guvenlik Motoru</strong></p>
  <p align="center">
    <a href="https://www.npmjs.com/package/dep-oracle"><img src="https://img.shields.io/npm/v/dep-oracle.svg" alt="npm version"></a>
    <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
    <a href="https://www.npmjs.com/package/dep-oracle"><img src="https://img.shields.io/npm/dm/dep-oracle.svg" alt="npm downloads"></a>
    <a href="https://github.com/ertugrulakben/dep-oracle"><img src="https://img.shields.io/github/stars/ertugrulakben/dep-oracle.svg?style=social" alt="GitHub stars"></a>
  </p>
  <p align="center">
    <a href="#hizli-baslangic">Hizli Baslangic</a> &middot;
    <a href="#ozellikler">Ozellikler</a> &middot;
    <a href="#guven-skoru-algoritmasi">Algoritma</a> &middot;
    <a href="#claude-code-entegrasyonu-mcp">MCP</a> &middot;
    <a href="#karsilastirma">Karsilastirma</a>
  </p>
  <p align="center">
    <a href="README.md">English</a> | <strong>Turkce</strong>
  </p>
</p>

---

> **Bagimliklarinin bagimliliklari var. Kim kontrol ediyor?**

**dep-oracle**, bagimlilik agacindaki her paket icin **Guven Skoru** (0-100) hesaplayan prediktif bir bagimlilik guvenlik motorudur. Zombi bagimliliklari tespit eder, patlama yaricapini olcer, typosquatting girisimlerini yakalar ve gelecekteki riskleri -- daha guvenlik acigina donusmeden -- onceden tahmin eder.

**Claude Code Security** sizin kodunuzu tarar. **dep-oracle** ise kodunuzun **bagimli oldugu her seyi** tarar.

## Neden dep-oracle?

Tedarik zinciri saldirilari (supply chain attacks) her yil daha buyuk bir tehdit haline geliyor:

- **2025'teki guvenlik ihlallerinin %62'si** tedarik zinciri saldirilari kaynakli
- Ortalama bir projede **683 gecisli (transitive) bagimlilik** bulunuyor
- `npm audit` yalnizca **bilinen** CVE'leri yakalayabiliyor -- dep-oracle gelecekteki riskleri **tahmin ediyor**
- Kendi kodunuzu denetliyorsunuz. Peki bagimlilik zincirinizi de denetliyor musunuz?

Turkiye'deki yazilim ekosistemi hizla buyuyor. Startuplardan kurumsallara, e-ticaret projelerinden fintech uygulamalarina kadar her yerde npm, pip ve yarn paketleri kullaniliyor. Ancak `node_modules` klasorunun icinde ne oldugunu kac kisi gercekten biliyor? Bir paket maintainer'i hesabini birakirsa, bir bagimlilik yillardir guncellenmiyorsa ya da ismini populer bir paketten degistirip kotu amacli kod enjekte eden biri varsa -- dep-oracle tam da bu noktalarda devreye giriyor.

## Hizli Baslangic

```bash
# Kurulum gerektirmez -- dogrudan calistirin
npx dep-oracle

# Ya da global olarak yukleyin
npm install -g dep-oracle
dep-oracle scan

# Tek bir paketi kontrol edin
dep-oracle check express
```

## Ozellikler

| Ozellik | Aciklama |
|---------|----------|
| **Guven Skoru** | Her paket icin 0-100 arasi agirlikli skor (guvenlik, maintainer sagligi, aktivite, popularite, fonlama, lisans) |
| **Zombi Tespiti** | Kritik ama bakimsiz paketleri bulur (12+ aydir commit yok) |
| **Patlama Yaricapi** | Bir bagimlilik ele gecirilirse kac dosyanin etkilenecegini gosterir |
| **Typosquat Tespiti** | 1.847+ bilinen paket + canli npm registry sorgusu ile suphelı isimleri yakalar |
| **Trend Tahmini** | Indirme/commit/release trendlerine dayali 3 aylik risk projeksiyonu |
| **Goc Danismani** | 131 paket eslesmesi ve 192 daha guvenli alternatif onerisi |
| **Cevrimdisi Mod** | Internet olmadan onbellekten calisir (`--offline`) |
| **MCP Sunucusu** | Claude Code ile dogal dilde bagimlilik sorgulama |
| **Coklu Format** | Terminal (renkli agac), HTML, JSON ve SARIF ciktisi |
| **GitHub Action** | CI/CD pipeline'inda otomatik guven kontrolu |

## Kullanim

```bash
# Mevcut projeyi tara
dep-oracle scan

# Farkli formatlarda cikti al
dep-oracle scan --format json
dep-oracle scan --format html
dep-oracle scan --format sarif

# Tek bir paketi kontrol et
dep-oracle check lodash
dep-oracle check express@4.18.2

# Cevrimdisi mod (yalnizca onbellek kullanilir)
dep-oracle scan --offline

# Minimum skor esigi belirle (altindaysa cikis kodu 1)
dep-oracle scan --threshold 60

# Belirli paketleri yoksay
dep-oracle scan --ignore deprecated-but-needed,legacy-pkg

# Ayrintili loglama
dep-oracle scan --verbose
```

## Cikti Ornegi

```
dep-oracle v1.1.0
package.json taraniyor...
47 dogrudan bagimlilik, 683 gecisli bagimlilik bulundu
Veri toplaniyor... [=============================] 100% (2.3s)

BAGIMLILIK GUVEN RAPORU
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  KRITIK (skor < 50)

  ■ event-stream@3.3.6         Skor: 12  ZOMBI
    Son commit: 2018 | 0 aktif maintainer
    Patlama yaricapi: 14 dosya | Alternatif: highland

  UYARI (skor 50-79)

  ■ moment@2.29.4              Skor: 58  ZOMBI
    Bakim modunda | Yeni ozellik yok
    Patlama yaricapi: 23 dosya | Alternatif: dayjs, date-fns, luxon

  GUVENLI (skor 80+): 679 paket

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OZET
  Genel Guven Skoru: 74/100
  Kritik: 2 | Uyari: 3 | Guvenli: 679
  Zombi: 2 | Kaldirilmis: 1
```

## Guven Skoru Algoritmasi

Her paket, alti agirlikli metrige gore 0-100 arasi puanlanir:

| Metrik | Agirlik | Neyi Olcer |
|--------|---------|------------|
| Guvenlik Gecmisi | %25 | CVE sayisi (azalan ceza modeli), ortalama yama suresi, hizli yama bonusu |
| Maintainer Sagligi | %25 | Aktif maintainer sayisi (bus factor), issue yanit suresi, PR merge hizi |
| Aktivite | %20 | Commit frekans trendi, surum kadansi, son yayinlama tarihi |
| Popularite | %15 | Haftalik indirme, bagimli paket sayisi, GitHub yildizlari |
| Fonlama | %10 | GitHub Sponsors, OpenCollective, kurumsal destek |
| Lisans | %5 | MIT/Apache = guvenli, GPL = risk, Bilinmeyen = kirmizi bayrak |

**Skor Araliklari:** 80-100 Guvenli | 50-79 Uyari | 0-49 Kritik

### Guvenlik Puanlamasi (v1.1.0)

Guvenlik metrigi **azalan ceza** modeli kullanir -- ilk guvenlik acigi en yuksek etkiye sahiptir, sonrakiler giderek azalan etkiye sahip olur:

| Guvenlik Acigi Sayisi | Guvenlik Puani |
|-----------------------|----------------|
| 0 | 100 |
| 1 | 85 |
| 2 | 72 |
| 3 | 60 |
| 4 | 50 |
| 5+ | max(20, 100 - n*12) |

Guvenlik aciklarini hizlica yamayan paketler (7 gun icinde) **+10 bonus** alir. Daha yavas yamalar (30 gun icinde) **+5 bonus** alir.

### Skor Nasil Hesaplaniyor?

Ornegin lodash paketini ele alalim:

- Guvenlik Gecmisi: Bilinen CVE'ler az, yamalar hizli -> 85 puan (x0.25 = 21.25)
- Maintainer Sagligi: Aktif maintainer'lar var ama sinirli -> 70 puan (x0.25 = 17.5)
- Aktivite: Son surum yakin tarihli -> 80 puan (x0.20 = 16)
- Popularite: Milyonlarca haftalik indirme -> 95 puan (x0.15 = 14.25)
- Fonlama: OpenCollective destegi var -> 60 puan (x0.10 = 6)
- Lisans: MIT -> 100 puan (x0.05 = 5)

**Toplam: 80/100 -- Guvenli**

### Hassas Bozulma (Graceful Degradation)

Bir API erisilemediyse (GitHub kapali, internet yok, rate limit), dep-oracle cokmez. Eksik metrik agirligi diger mevcut metriklere dagilir. 3+ metrik kullanilama durumunda guvenilirlik uyarisi gosterilir.

## Typosquat Tespiti

dep-oracle, typosquatting'i yakalamak icin cok katmanli bir yaklasim kullanir:

1. **Statik kayit** -- 40+ kategoride 1.847+ bilinen populer paket adi (React, Vue, Angular, Express, test araclari, CLI araclari vb.)
2. **Dinamik npm sorgusu** -- npm'den en cok indirilen 5.000 paketi ceker ve 7 gun boyunca onbellegine alir
3. **Oruntu eslestirme** -- Levenshtein mesafesi, onek/sonek manipulasyonu, karakter degisimi, eksik/fazla harf tespiti

```bash
dep-oracle check expresss    # Yakalar: "express"e benzer (mesafe: 1)
dep-oracle check lodashe     # Yakalar: "lodash"a benzer (mesafe: 1)
dep-oracle check react-js    # Yakalar: "react" sonek oruntusu
```

## Goc Danismani

Bir paket dusuk skor aldiginda veya zombi olarak isaretlendiginde, dep-oracle **131 paket eslesmesi** ve **192 alternatif** iceren kuratorlu bir veritabanindan daha guvenli secenekler onerir:

```
moment     → dayjs, date-fns, luxon
request    → axios, got, node-fetch, undici
lodash     → lodash-es, radash, just (native alternatifler)
express    → fastify, koa, hono
gulp       → esbuild, tsup, vite
mocha      → vitest, jest, node:test
...ve 125 paket daha
```

Her oneri zorluk derecesi (kolay/orta/zor) ve goc baglami icerir.

## Claude Code Entegrasyonu (MCP)

dep-oracle, Claude Code icin bir MCP sunucusu olarak calisir:

```json
// .claude/settings.json
{
  "mcpServers": {
    "dep-oracle": {
      "command": "npx",
      "args": ["dep-oracle", "mcp"]
    }
  }
}
```

Ayarladiktan sonra Claude Code icinde dogrudan sorabilirsiniz:

- *"Bu projedeki en riskli bagimlilik hangisi?"*
- *"lodash kullanmak guvenli mi?"*
- *"Zombi bagimliliklari goster"*
- *"moment.js icin alternatif oner"*
- *"Guven skoru 50'nin altindaki paketleri listele"*

**Mevcut MCP Araclari:**

| Arac | Aciklama |
|------|----------|
| `dep_oracle_scan` | Tam proje bagimlilik taramasi |
| `dep_oracle_trust_score` | Tek paket guven skoru |
| `dep_oracle_blast_radius` | Paket etki analizi |
| `dep_oracle_zombies` | Tum zombi bagimliliklari listele |
| `dep_oracle_suggest_migration` | Alternatif paket onerileri |

## GitHub Action

```yaml
name: Bagimlilik Guven Kontrolu
on: [pull_request]

jobs:
  dep-oracle:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ertugrulakben/dep-oracle-action@v1
        with:
          threshold: 60
          format: sarif
```

Bu konfigurasyonla:
- Her PR'da otomatik bagimlilik taramasi yapilir
- Guven skoru 60'in altindaki paketler icin uyari verilir
- SARIF formatinda cikti uretilir ve GitHub Security sekmesinde goruntulenir

## Konfigurasyon

Proje kokunde `.dep-oraclerc.json` dosyasi olusturun:

```json
{
  "threshold": 60,
  "ignore": ["bilinen-riskli-ama-gerekli"],
  "format": "terminal",
  "offline": false,
  "githubToken": "$GITHUB_TOKEN",
  "cacheTtl": 86400
}
```

Ya da `package.json` icinde tanimlayabilirsiniz:

```json
{
  "dep-oracle": {
    "threshold": 60,
    "ignore": []
  }
}
```

### Konfigurasyon Secenekleri

| Secenek | Varsayilan | Aciklama |
|---------|-----------|----------|
| `threshold` | `60` | Minimum guven skoru esigi. Altindaki paketler uyari verir ve sifir olmayan cikis kodu dondurur |
| `ignore` | `[]` | Tarama disinda tutulacak paket listesi |
| `format` | `"terminal"` | Cikti formati: `terminal`, `json`, `html`, `sarif` |
| `offline` | `false` | Cevrimdisi mod. Yalnizca onbellek kullanilir, API cagrisi yapilmaz |
| `githubToken` | `null` | GitHub API rate limit'i artirmak icin token (5000/saat vs 60/saat) |
| `cacheTtl` | `86400` | Onbellek gecerlilik suresi (saniye cinsinden, varsayilan: 24 saat) |

## Desteklenen Paket Yoneticileri

| Yonetici | Manifest Dosyasi | Kilit Dosyasi | Durum |
|----------|-------------------|---------------|-------|
| npm | `package.json` | `package-lock.json` | Destekleniyor |
| yarn | `package.json` | `yarn.lock` | Destekleniyor |
| pnpm | `package.json` | `pnpm-lock.yaml` | Destekleniyor |
| pip | `requirements.txt` | `Pipfile.lock` | Destekleniyor |
| poetry | `pyproject.toml` | `poetry.lock` | Destekleniyor |

## Karsilastirma

| Ozellik | npm audit | Dependabot | Socket.dev | Snyk | **dep-oracle** |
|---------|-----------|------------|------------|------|----------------|
| Bilinen CVE taramasi | Var | Var | Var | Var | **Var** |
| Prediktif risk analizi | Yok | Yok | Kismi | Yok | **Var** |
| Guven Skoru (0-100) | Yok | Yok | Yok | Yok | **Var** |
| Zombi tespiti | Yok | Yok | Yok | Yok | **Var** |
| Patlama yaricapi | Yok | Yok | Yok | Yok | **Var** |
| Typosquat tespiti | Yok | Yok | Var | Yok | **Var** |
| Trend tahmini | Yok | Yok | Yok | Yok | **Var** |
| Goc danismani | Yok | Kismi | Yok | Kismi | **Var (131 paket)** |
| MCP entegrasyonu | Yok | Yok | Var | Var | **Var** |
| Sifir kurulum (npx) | Var | Yok | Yok | Yok | **Var** |
| Ucretsiz ve acik kaynak | Var | Var | Freemium | Freemium | **Var** |

## Programatik API

```typescript
import { scan, checkPackage } from 'dep-oracle';

// Projeyi tara
const report = await scan({ dir: './benim-projem', format: 'json' });

// Tek paket kontrol et
const result = await checkPackage('express');
console.log(result.trustScore); // 74
console.log(result.isZombie);   // false
```

## Test Suite

dep-oracle kapsamli test kapsamisina sahiptir:

```
10 test dosyasi | 144 test | %100 basarili

  trust-score.test.ts     34 test   Puanlama motoru, metrikler, kenar durumlar
  zombie-detector.test.ts 10 test   Zombi tespit mantigi
  typosquat.test.ts       15 test   Typosquat oruntu eslestirme
  migration-advisor.test.ts 12 test Goc onerileri
  trend-predictor.test.ts 10 test   Trend tahmin motoru
  parsers.test.ts         17 test   npm + Python parser'lari
  cache.test.ts           15 test   Onbellek islemleri
  logger.test.ts          17 test   Logger yardimci araci
  rate-limiter.test.ts    6 test    Rate limiter
  schema.test.ts          8 test    Zod sema dogrulama
```

```bash
npm test          # Tum testleri calistir
npm run lint      # TypeScript tip kontrolu
```

## Degisiklik Gunlugu

### v1.1.0 (2025-02-22)

- **Typosquat Tespiti**: 40+ kategoride 1.847+ bilinen pakete genisletildi, ayrica dinamik npm registry sorgusu eklendi (en populer 5.000 paket, 7 gunluk onbellek)
- **Goc Danismani**: 131 paket eslesmesi ve 192 daha guvenli alternatife genisletildi
- **Guven Skoru Kalibrasyonu**: Azalan guvenlik acigi cezasi (ilk CVE en yuksek etki), hizli yama bonusu (<=7 gun icin +10)
- **Poetry.lock Destegi**: Python projeleri icin tam poetry.lock ayristirma
- **Kapsamli Test Suite**: 10 test dosyasi, 144 test -- tum analizciler, parser'lar, onbellek ve yardimci araclari kapsar
- **Turkce README**: Tam Turkce dokumantasyon
- **Dinamik CLI Versiyonu**: Versiyon otomatik olarak package.json'dan senkronize edilir

### v1.0.0 (2025-02-22)

- Ilk surum
- 6 agirlikli metrikli Guven Skoru motoru
- npm + Python (pip, poetry, pyproject.toml) parser'lari
- Zombi tespiti, patlama yaricapi analizi
- Levenshtein mesafesi ile typosquat tespiti
- Trend tahmini (3 aylik risk projeksiyonu)
- Kuratorlu alternatiflerle goc danismani
- Terminal, HTML, JSON, SARIF cikti formatlari
- Claude Code entegrasyonu icin MCP sunucusu
- GitHub Action destegi
- SQLite uyumlu onbellek ile cevrimdisi mod
- Rozet ureticisi (SVG)

## Katkida Bulunma

Katkida bulunmak istiyorsaniz [CONTRIBUTING.md](CONTRIBUTING.md) dosyasina goz atin. Gelistirme ortami kurulumu, kodlama standartlari ve yeni collector/parser/analyzer ekleme rehberi orada.

Her turlu katki degerlidir: hata bildirimi, dokumantasyon iyilestirmesi, yeni ozellik onerisi veya kod katkisi.

## Lisans

[MIT](LICENSE) -- [Ertugrul Akben](https://ertugrulakben.com)
