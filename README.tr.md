<p align="center">
  <img src="cover.jpeg" alt="dep-oracle kapak" width="100%">
</p>

<p align="center">
  <h1 align="center">dep-oracle</h1>
  <p align="center"><strong>Prediktif Bağımlılık Güvenlik Motoru</strong></p>
  <p align="center">
    <a href="https://www.npmjs.com/package/dep-oracle"><img src="https://img.shields.io/npm/v/dep-oracle.svg" alt="npm version"></a>
    <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
    <a href="https://www.npmjs.com/package/dep-oracle"><img src="https://img.shields.io/npm/dm/dep-oracle.svg" alt="npm downloads"></a>
    <a href="https://github.com/ertugrulakben/dep-oracle"><img src="https://img.shields.io/github/stars/ertugrulakben/dep-oracle.svg?style=social" alt="GitHub stars"></a>
    <a href="https://modelcontextprotocol.io/registry"><img src="https://img.shields.io/badge/MCP-Registry-blue" alt="MCP Registry"></a>
  </p>
  <p align="center">
    <a href="#hızlı-başlangıç">Hızlı Başlangıç</a> &middot;
    <a href="#özellikler">Özellikler</a> &middot;
    <a href="#güven-skoru-algoritması">Algoritma</a> &middot;
    <a href="#claude-code-entegrasyonu-mcp">MCP</a> &middot;
    <a href="#karşılaştırma">Karşılaştırma</a>
  </p>
  <p align="center">
    <a href="README.md">English</a> | <strong>Türkçe</strong>
  </p>
</p>

---

> **Bağımlılıklarının bağımlılıkları var. Kim kontrol ediyor?**

**dep-oracle**, bağımlılık ağacındaki her paket için **Güven Skoru** (0-100) hesaplayan prediktif bir bağımlılık güvenlik motorudur. Zombi bağımlılıkları tespit eder, patlama yarıçapını ölçer, typosquatting girişimlerini yakalar ve gelecekteki riskleri — daha güvenlik açığına dönüşmeden — önceden tahmin eder.

**Claude Code Security** sizin kodunuzu tarar. **dep-oracle** ise kodunuzun **bağımlı olduğu her şeyi** tarar.

## Neden dep-oracle?

Tedarik zinciri saldırıları (supply chain attacks) her yıl daha büyük bir tehdit haline geliyor:

- **2025'teki güvenlik ihlallerinin %62'si** tedarik zinciri saldırıları kaynaklı
- Ortalama bir projede **683 geçişli (transitive) bağımlılık** bulunuyor
- `npm audit` yalnızca **bilinen** CVE'leri yakalayabiliyor — dep-oracle gelecekteki riskleri **tahmin ediyor**
- Kendi kodunuzu denetliyorsunuz. Peki bağımlılık zincirinizi de denetliyor musunuz?

Türkiye'deki yazılım ekosistemi hızla büyüyor. Startup'lardan kurumsallara, e-ticaret projelerinden fintech uygulamalarına kadar her yerde npm, pip ve yarn paketleri kullanılıyor. Ancak `node_modules` klasörünün içinde ne olduğunu kaç kişi gerçekten biliyor? Bir paket maintainer'ı hesabını bırakırsa, bir bağımlılık yıllardır güncellenmiyorsa ya da ismini popüler bir paketten değiştirip kötü amaçlı kod enjekte eden biri varsa — dep-oracle tam da bu noktalarda devreye giriyor.

## Hızlı Başlangıç

```bash
# Kurulum gerektirmez — doğrudan çalıştırın
npx dep-oracle

# Ya da global olarak yükleyin
npm install -g dep-oracle
dep-oracle scan

# Tek bir paketi kontrol edin
dep-oracle check express
```

## Özellikler

| Özellik | Açıklama |
|---------|----------|
| **Güven Skoru** | Her paket için 0-100 arası ağırlıklı skor (güvenlik, maintainer sağlığı, aktivite, popülarite, fonlama, lisans) |
| **Zombi Tespiti** | Kritik ama bakımsız paketleri bulur (12+ aydır commit yok) |
| **Patlama Yarıçapı** | Bir bağımlılık ele geçirilirse kaç dosyanın etkileneceğini gösterir |
| **Typosquat Tespiti** | 1.847+ bilinen paket + canlı npm registry sorgusu ile şüpheli isimleri yakalar |
| **Trend Tahmini** | İndirme/commit/release trendlerine dayalı 3 aylık risk projeksiyonu |
| **Göç Danışmanı** | 131 paket eşleşmesi ve 192 daha güvenli alternatif önerisi |
| **Çevrimdışı Mod** | İnternet olmadan önbellekten çalışır (`--offline`) |
| **MCP Sunucusu** | Claude Code ile doğal dilde bağımlılık sorgulama |
| **Çoklu Format** | Terminal (renkli ağaç), HTML, JSON ve SARIF çıktısı |
| **GitHub Action** | CI/CD pipeline'ında otomatik güven kontrolü |

## Kullanım

```bash
# Mevcut projeyi tara
dep-oracle scan

# Farklı formatlarda çıktı al
dep-oracle scan --format json
dep-oracle scan --format html
dep-oracle scan --format sarif

# Tek bir paketi kontrol et
dep-oracle check lodash
dep-oracle check express@4.18.2

# Çevrimdışı mod (yalnızca önbellek kullanılır)
dep-oracle scan --offline

# Minimum skor eşiği belirle (altındaysa çıkış kodu 1)
dep-oracle scan --threshold 60

# Belirli paketleri yoksay
dep-oracle scan --ignore deprecated-but-needed,legacy-pkg

# Ayrıntılı loglama
dep-oracle scan --verbose
```

## Çıktı Örneği

```
dep-oracle v1.1.4
package.json taranıyor...
47 doğrudan bağımlılık, 683 geçişli bağımlılık bulundu
Veri toplanıyor... [=============================] 100% (2.3s)

BAĞIMLILIK GÜVEN RAPORU
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  KRİTİK (skor < 50)

  ■ event-stream@3.3.6         Skor: 12  ZOMBİ
    Son commit: 2018 | 0 aktif maintainer
    Patlama yarıçapı: 14 dosya | Alternatif: highland

  UYARI (skor 50-79)

  ■ moment@2.29.4              Skor: 58  ZOMBİ
    Bakım modunda | Yeni özellik yok
    Patlama yarıçapı: 23 dosya | Alternatif: dayjs, date-fns, luxon

  GÜVENLİ (skor 80+): 679 paket

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ÖZET
  Genel Güven Skoru: 74/100
  Kritik: 2 | Uyarı: 3 | Güvenli: 679
  Zombi: 2 | Kaldırılmış: 1
```

## Güven Skoru Algoritması

Her paket, altı ağırlıklı metriğe göre 0-100 arası puanlanır:

| Metrik | Ağırlık | Neyi Ölçer |
|--------|---------|------------|
| Güvenlik Geçmişi | %25 | CVE sayısı (azalan ceza modeli), ortalama yama süresi, hızlı yama bonusu |
| Maintainer Sağlığı | %25 | Aktif maintainer sayısı (bus factor), issue yanıt süresi, PR merge hızı |
| Aktivite | %20 | Commit frekans trendi, sürüm kadansı, son yayınlama tarihi |
| Popülarite | %15 | Haftalık indirme, bağımlı paket sayısı, GitHub yıldızları |
| Fonlama | %10 | GitHub Sponsors, OpenCollective, kurumsal destek |
| Lisans | %5 | MIT/Apache = güvenli, GPL = risk, Bilinmeyen = kırmızı bayrak |

**Skor Aralıkları:** 80-100 Güvenli | 50-79 Uyarı | 0-49 Kritik

### Güvenlik Puanlaması

Güvenlik metriği **azalan ceza** modeli kullanır — ilk güvenlik açığı en yüksek etkiye sahiptir, sonrakiler giderek azalan etkiye sahip olur:

| Güvenlik Açığı Sayısı | Güvenlik Puanı |
|-----------------------|----------------|
| 0 | 100 |
| 1 | 85 |
| 2 | 72 |
| 3 | 60 |
| 4 | 50 |
| 5+ | max(20, 100 - n*12) |

Güvenlik açıklarını hızlıca yamayan paketler (7 gün içinde) **+10 bonus** alır. Daha yavaş yamalar (30 gün içinde) **+5 bonus** alır.

### Skor Nasıl Hesaplanıyor?

Örneğin lodash paketini ele alalım:

- Güvenlik Geçmişi: Bilinen CVE'ler az, yamalar hızlı → 85 puan (x0.25 = 21.25)
- Maintainer Sağlığı: Aktif maintainer'lar var ama sınırlı → 70 puan (x0.25 = 17.5)
- Aktivite: Son sürüm yakın tarihli → 80 puan (x0.20 = 16)
- Popülarite: Milyonlarca haftalık indirme → 95 puan (x0.15 = 14.25)
- Fonlama: OpenCollective desteği var → 60 puan (x0.10 = 6)
- Lisans: MIT → 100 puan (x0.05 = 5)

**Toplam: 80/100 — Güvenli**

### Zarif Bozulma (Graceful Degradation)

Bir API erişilemediyse (GitHub kapalı, internet yok, rate limit), dep-oracle çökmez. Eksik metrik ağırlığı diğer mevcut metriklere dağılır. 3+ metrik kullanılamaz durumda ise güvenilirlik uyarısı gösterilir.

## Typosquat Tespiti

dep-oracle, typosquatting'i yakalamak için çok katmanlı bir yaklaşım kullanır:

1. **Statik kayıt** — 40+ kategoride 1.847+ bilinen popüler paket adı (React, Vue, Angular, Express, test araçları, CLI araçları vb.)
2. **Dinamik npm sorgusu** — npm'den en çok indirilen 5.000 paketi çeker ve 7 gün boyunca önbelleğine alır
3. **Örüntü eşleştirme** — Levenshtein mesafesi, önek/sonek manipülasyonu, karakter değişimi, eksik/fazla harf tespiti

```bash
dep-oracle check expresss    # Yakalar: "express"e benzer (mesafe: 1)
dep-oracle check lodashe     # Yakalar: "lodash"a benzer (mesafe: 1)
dep-oracle check react-js    # Yakalar: "react" sonek örüntüsü
```

## Göç Danışmanı

Bir paket düşük skor aldığında veya zombi olarak işaretlendiğinde, dep-oracle **131 paket eşleşmesi** ve **192 alternatif** içeren küratörlü bir veritabanından daha güvenli seçenekler önerir:

```
moment     → dayjs, date-fns, luxon
request    → axios, got, node-fetch, undici
lodash     → lodash-es, radash, just (native alternatifler)
express    → fastify, koa, hono
gulp       → esbuild, tsup, vite
mocha      → vitest, jest, node:test
...ve 125 paket daha
```

Her öneri zorluk derecesi (kolay/orta/zor) ve göç bağlamı içerir.

## Claude Code Entegrasyonu (MCP)

dep-oracle, resmi **[MCP Registry](https://modelcontextprotocol.io/registry)**'de kayıtlıdır ve Claude Code için bir MCP sunucusu olarak çalışır:

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

Ayarladıktan sonra Claude Code içinde doğrudan sorabilirsiniz:

- *"Bu projedeki en riskli bağımlılık hangisi?"*
- *"lodash kullanmak güvenli mi?"*
- *"Zombi bağımlılıkları göster"*
- *"moment.js için alternatif öner"*
- *"Güven skoru 50'nin altındaki paketleri listele"*

**Mevcut MCP Araçları:**

| Araç | Açıklama |
|------|----------|
| `dep_oracle_scan` | Tam proje bağımlılık taraması |
| `dep_oracle_trust_score` | Tek paket güven skoru |
| `dep_oracle_blast_radius` | Paket etki analizi |
| `dep_oracle_zombies` | Tüm zombi bağımlılıkları listele |
| `dep_oracle_suggest_migration` | Alternatif paket önerileri |

## GitHub Action

```yaml
name: Bağımlılık Güven Kontrolü
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

Bu konfigürasyonla:
- Her PR'da otomatik bağımlılık taraması yapılır
- Güven skoru 60'ın altındaki paketler için uyarı verilir
- SARIF formatında çıktı üretilir ve GitHub Security sekmesinde görüntülenir

## Konfigürasyon

Proje kökünde `.dep-oraclerc.json` dosyası oluşturun:

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

Ya da `package.json` içinde tanımlayabilirsiniz:

```json
{
  "dep-oracle": {
    "threshold": 60,
    "ignore": []
  }
}
```

### Konfigürasyon Seçenekleri

| Seçenek | Varsayılan | Açıklama |
|---------|-----------|----------|
| `threshold` | `60` | Minimum güven skoru eşiği. Altındaki paketler uyarı verir ve sıfır olmayan çıkış kodu döndürür |
| `ignore` | `[]` | Tarama dışında tutulacak paket listesi |
| `format` | `"terminal"` | Çıktı formatı: `terminal`, `json`, `html`, `sarif` |
| `offline` | `false` | Çevrimdışı mod. Yalnızca önbellek kullanılır, API çağrısı yapılmaz |
| `githubToken` | `null` | GitHub API rate limit'i artırmak için token (5000/saat vs 60/saat) |
| `cacheTtl` | `86400` | Önbellek geçerlilik süresi (saniye cinsinden, varsayılan: 24 saat) |

## Desteklenen Paket Yöneticileri

| Yönetici | Manifest Dosyası | Kilit Dosyası | Durum |
|----------|-------------------|---------------|-------|
| npm | `package.json` | `package-lock.json` | Destekleniyor |
| yarn | `package.json` | `yarn.lock` | Destekleniyor |
| pnpm | `package.json` | `pnpm-lock.yaml` | Destekleniyor |
| pip | `requirements.txt` | `Pipfile.lock` | Destekleniyor |
| poetry | `pyproject.toml` | `poetry.lock` | Destekleniyor |

## Karşılaştırma

| Özellik | npm audit | Dependabot | Socket.dev | Snyk | **dep-oracle** |
|---------|-----------|------------|------------|------|----------------|
| Bilinen CVE taraması | Var | Var | Var | Var | **Var** |
| Prediktif risk analizi | Yok | Yok | Kısmi | Yok | **Var** |
| Güven Skoru (0-100) | Yok | Yok | Yok | Yok | **Var** |
| Zombi tespiti | Yok | Yok | Yok | Yok | **Var** |
| Patlama yarıçapı | Yok | Yok | Yok | Yok | **Var** |
| Typosquat tespiti | Yok | Yok | Var | Yok | **Var** |
| Trend tahmini | Yok | Yok | Yok | Yok | **Var** |
| Göç danışmanı | Yok | Kısmi | Yok | Kısmi | **Var (131 paket)** |
| MCP entegrasyonu | Yok | Yok | Var | Var | **Var** |
| Sıfır kurulum (npx) | Var | Yok | Yok | Yok | **Var** |
| Ücretsiz ve açık kaynak | Var | Var | Freemium | Freemium | **Var** |

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

dep-oracle kapsamlı test kapsamına sahiptir:

```
10 test dosyası | 144 test | %100 başarılı

  trust-score.test.ts     34 test   Puanlama motoru, metrikler, kenar durumlar
  zombie-detector.test.ts 10 test   Zombi tespit mantığı
  typosquat.test.ts       15 test   Typosquat örüntü eşleştirme
  migration-advisor.test.ts 12 test Göç önerileri
  trend-predictor.test.ts 10 test   Trend tahmin motoru
  parsers.test.ts         17 test   npm + Python parser'ları
  cache.test.ts           15 test   Önbellek işlemleri
  logger.test.ts          17 test   Logger yardımcı aracı
  rate-limiter.test.ts    6 test    Rate limiter
  schema.test.ts          8 test    Zod şema doğrulama
```

```bash
npm test          # Tüm testleri çalıştır
npm run lint      # TypeScript tip kontrolü
```

## Değişiklik Günlüğü

### v1.1.4 (2026-02-22)

- **Package.json Duzeltmesi**: npm'de README yerine literal string gosterilmesine neden olan gecersiz `readme` alani kaldirildi

### v1.1.3 (2026-02-22)

- **npm README Duzeltmesi**: npmjs.com'da artik Ingilizce README gorunuyor (Turkce README npm paketinden haric tutuldu)

### v1.1.2 (2026-02-22)

- **MCP Registry Linkleri**: Resmi dokumantasyon URL'sine guncellendi

### v1.1.1 (2026-02-22)

- **MCP Registry**: Resmi [MCP Registry](https://modelcontextprotocol.io/registry)'de `io.github.ertugrulakben/dep-oracle` olarak yayinlandi
- **Dinamik Versiyon**: MCP sunucusu ve SARIF raporcusu artik versiyonu package.json'dan okuyor

### v1.1.0 (2026-02-22)

- **Typosquat Tespiti**: 40+ kategoride 1.847+ bilinen pakete genişletildi, ayrıca dinamik npm registry sorgusu eklendi (en popüler 5.000 paket, 7 günlük önbellek)
- **Göç Danışmanı**: 131 paket eşleşmesi ve 192 daha güvenli alternatife genişletildi
- **Güven Skoru Kalibrasyonu**: Azalan güvenlik açığı cezası (ilk CVE en yüksek etki), hızlı yama bonusu (<=7 gün için +10)
- **Poetry.lock Desteği**: Python projeleri için tam poetry.lock ayrıştırma
- **Kapsamlı Test Suite**: 10 test dosyası, 144 test — tüm analizörler, parser'lar, önbellek ve yardımcı araçları kapsar
- **Türkçe README**: Tam Türkçe dokümantasyon
- **Dinamik CLI Versiyonu**: Versiyon otomatik olarak package.json'dan senkronize edilir

### v1.0.0 (2026-02-22)

- İlk sürüm
- 6 ağırlıklı metrikli Güven Skoru motoru
- npm + Python (pip, poetry, pyproject.toml) parser'ları
- Zombi tespiti, patlama yarıçapı analizi
- Levenshtein mesafesi ile typosquat tespiti
- Trend tahmini (3 aylık risk projeksiyonu)
- Küratörlü alternatiflerle göç danışmanı
- Terminal, HTML, JSON, SARIF çıktı formatları
- Claude Code entegrasyonu için MCP sunucusu
- GitHub Action desteği
- SQLite uyumlu önbellek ile çevrimdışı mod
- Rozet üreticisi (SVG)

## Katkıda Bulunma

Katkıda bulunmak istiyorsanız [CONTRIBUTING.md](CONTRIBUTING.md) dosyasına göz atın. Geliştirme ortamı kurulumu, kodlama standartları ve yeni collector/parser/analyzer ekleme rehberi orada.

Her türlü katkı değerlidir: hata bildirimi, dokümantasyon iyileştirmesi, yeni özellik önerisi veya kod katkısı.

## Lisans

[MIT](LICENSE) — [Ertuğrul Akben](https://ertugrulakben.com)
