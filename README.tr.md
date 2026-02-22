# dep-oracle

> Bagimliklarinin bagimliliklari var. Kim kontrol ediyor?

**dep-oracle**, bagimlilik agacindaki her paket icin **Guven Skoru** (0-100) hesaplayan prediktif bir bagimlilik guvenlik motorudur. Zombi bagimliliklari tespit eder, patlama yaricapini olcer, typosquatting girisimlerini yakalar ve gelecekteki riskleri -- daha guvenlik acigina donusmeden -- onceden tahmin eder.

[![npm version](https://img.shields.io/npm/v/dep-oracle.svg)](https://www.npmjs.com/package/dep-oracle)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Neden dep-oracle?

Tedarik zinciri saldirilari (supply chain attacks) her yil daha buyuk bir tehdit haline geliyor. Rakamlar net:

- **2025'teki guvenlik ihlallerinin %62'si** tedarik zinciri saldirilari kaynakli
- Ortalama bir projede **683 gecisli (transitive) bagimlilik** bulunuyor
- `npm audit` yalnizca **bilinen** CVE'leri yakalayabiliyor -- dep-oracle gelecekteki riskleri **tahmin ediyor**
- Kendi kodunuzu denetliyorsunuz. Peki bagimlilik zincirinizi de denetliyor musunuz?

Turkiye'deki yazilim ekosistemi hizla buyuyor. Startuplardan kurumsallara, e-ticaret projelerinden fintech uygulamalarina kadar her yerde npm, pip ve yarn paketleri kullaniliyor. Ancak `node_modules` klasorunun icinde ne oldugunu kac kisi gercekten biliyor? Bir paket maintainer'i hesabini birakirsa, bir bagimlilik yillardir guncellenmiyorsa ya da ismini populer bir paketten degistirip kotu amacli kod enjekte eden biri varsa -- dep-oracle tam da bu noktalarda devreye giriyor.

**Claude Code Security** sizin kodunuzu tarar. **dep-oracle** ise kodunuzun **bagimli oldugu her seyi** tarar.

## Hizli Baslangic

```bash
# Kurulum gerektirmez -- dogrudan calistirin
npx dep-oracle

# Ya da global olarak yukleyin
npm install -g dep-oracle
dep-oracle scan
```

Tek bir komutla projenizin tam bagimlilik guven raporunu alin. Kurulum, konfigürasyon, hesap acma derdi yok.

## Ozellikler

| Ozellik | Aciklama |
|---------|----------|
| **Guven Skoru** | Her paket icin 0-100 arasi agirlikli skor (maintainer sagligi, guvenlik, aktivite, popularite, fonlama, lisans) |
| **Zombi Tespiti** | Kritik ama bakimsiz paketleri bulur (12+ aydir commit yok) |
| **Patlama Yaricapi** | Bir bagimlilik ele gecirilirse kac dosyanin etkilenecegini gosterir |
| **Typosquat Tespiti** | Populer paketlere benzer suphelı paket adlarini yakalar |
| **Trend Tahmini** | Indirme/commit trendlerine dayali 3 aylik risk projeksiyonu |
| **Goc Danismani** | Riskli bagimliklar icin daha guvenli alternatifler onerir |
| **Cevrimdisi Mod** | Internet olmadan onbellekten calisir (`--offline`) |
| **MCP Entegrasyonu** | Claude Code ile dogrudan entegrasyon |
| **GitHub Action** | CI/CD pipeline'ina dogrudan entegre edin |
| **Coklu Format** | Terminal, HTML, JSON ve SARIF ciktisi destegi |

## Kullanim Ornekleri

```bash
# Mevcut projeyi tara
dep-oracle scan

# Farkli formatlarda cikti al
dep-oracle scan --format json
dep-oracle scan --format html
dep-oracle scan --format sarif

# Tek bir paketi kontrol et
dep-oracle check lodash

# Cevrimdisi mod (onbellekteki verileri kullanir)
dep-oracle scan --offline

# Minimum skor esigi belirle (CI/CD icin ideal)
dep-oracle scan --threshold 60

# Belirli paketleri yoksay
dep-oracle scan --ignore deprecated-but-needed,legacy-pkg
```

## Cikti Ornegi

```
dep-oracle v1.0.0
package.json taraniyor...
47 dogrudan bagimlilik, 683 gecisli bagimlilik bulundu
Veri toplaniyor... [=============================] 100% (2.3s)

BAGIMLILIK GUVEN RAPORU

KRITIK (skor < 50)

  event-stream@3.3.6         Skor: 12  ZOMBI
    Son commit: 2018 | 0 aktif maintainer
    Patlama yaricapi: 14 dosya | Alternatif: highland

UYARI (skor 50-79)

  moment@2.29.4              Skor: 58  ZOMBI
    Bakim modunda | Yeni ozellik yok
    Patlama yaricapi: 23 dosya | Alternatif: dayjs

GUVENLI (skor 80+): 679 paket

OZET
  Genel Guven Skoru: 74/100
  Kritik: 2 | Uyari: 3 | Guvenli: 679
  Zombi: 2 | Kaldirilmis: 1
```

## Guven Skoru Algoritmasi

Her paket, alti agirlikli metrige gore 0-100 arasi puanlanir:

| Metrik | Agirlik | Neyi Olcer |
|--------|---------|------------|
| Guvenlik Gecmisi | %25 | CVE sayisi, ortalama yama suresi, guvenlik acigi yogunlugu |
| Maintainer Sagligi | %25 | Aktif maintainer sayisi (bus factor), issue yanit suresi, PR merge hizi |
| Aktivite | %20 | Commit frekans trendi, surum kadansi, son yayinlama tarihi |
| Popularite | %15 | Haftalik indirme, bagimli paket sayisi, GitHub yildizlari |
| Fonlama | %10 | GitHub Sponsors, OpenCollective, kurumsal destek |
| Lisans | %5 | MIT/Apache = guvenli, GPL = risk, Bilinmeyen = kirmizi bayrak |

**Skor Araliklari:** 80-100 Guvenli | 50-79 Uyari | 0-49 Kritik

### Skor nasil hesaplaniyor?

Ornegin lodash paketini ele alalim:

- Guvenlik Gecmisi: Bilinen CVE'ler az, yamalar hizli -> 85 puan (x0.25 = 21.25)
- Maintainer Sagligi: Aktif maintainer'lar var ama sinirli -> 70 puan (x0.25 = 17.5)
- Aktivite: Son surum yakin tarihli -> 80 puan (x0.20 = 16)
- Popularite: Milyonlarca haftalik indirme -> 95 puan (x0.15 = 14.25)
- Fonlama: OpenCollective destegi var -> 60 puan (x0.10 = 6)
- Lisans: MIT -> 100 puan (x0.05 = 5)

**Toplam: 80/100 -- Guvenli**

## Claude Code Entegrasyonu (MCP)

dep-oracle, Claude Code icin bir MCP sunucusu olarak calisir. Ayarlamaniz cok basit:

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

- "Bu projedeki en riskli bagimlilik hangisi?"
- "lodash kullanmak guvenli mi?"
- "Zombi bagimliliklari goster"
- "Guven skoru 50'nin altindaki paketleri listele"
- "moment.js icin alternatif oner"

Claude Code, dep-oracle'in verdigi verileri kullanarak size anlamli ve baglamsal yanıtlar verir.

## GitHub Action

dep-oracle'i CI/CD pipeline'iniza entegre ederek her pull request'te otomatik bagimlilik guven kontrolu yapabilirsiniz:

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
| `threshold` | `60` | Minimum guven skoru esigi. Altindaki paketler uyari verir |
| `ignore` | `[]` | Tarama disinda tutulacak paket listesi |
| `format` | `"terminal"` | Cikti formati: `terminal`, `json`, `html`, `sarif` |
| `offline` | `false` | Cevrimdisi mod. `true` olursa yalnizca onbellek kullanilir |
| `githubToken` | `null` | GitHub API rate limit'i artirmak icin token |
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
| MCP entegrasyonu | Yok | Yok | Var | Var | **Var** |
| Sifir kurulum (npx) | Var | Yok | Yok | Yok | **Var** |
| Ucretsiz | Var | Var | Freemium | Freemium | **Var** |

dep-oracle, mevcut araclarin yerini almak icin degil, onlarin biraktigi boslugu doldurmak icin tasarlandi. `npm audit` bilinen aciklari yakaliyorsa, dep-oracle henuz bildirilmemis ama olusmak uzere olan riskleri gosterir.

## Katkida Bulunma

Katkida bulunmak istiyorsaniz [CONTRIBUTING.md](CONTRIBUTING.md) dosyasina goz atin. Gelistirme ortami kurulumu, kodlama standartlari ve yeni collector/parser ekleme rehberi orada.

Her turlu katki degerlidir: hata bildirimi, dokumantasyon iyilestirmesi, yeni ozellik onerisi veya kod katkisi.

## Lisans

[MIT](LICENSE) -- Ertugrul Akben
