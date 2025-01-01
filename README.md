# Lang Assist Platform

Lang Assist, dil öğrenimini kolaylaştırmak ve desteklemek için tasarlanmış kapsamlı bir platformdur.

## Alt Projeler

### Mobile App (./bin/mobile/)

- Platform kullanıcılarının mobil uygulaması
- [Repository](https://github.com/lang-assist/mobile)
- Teknolojiler: Flutter, Dart, GraphQL

### Admin Web (./bin/admin-web/)

- Platform yöneticilerinin web uygulaması
- [Repository](https://github.com/lang-assist/admin-web)
- Teknolojiler: Flutter, Dart, GraphQL

### Server (./bin/server/)

- Platformun backend kısmı
- [Repository](https://github.com/lang-assist/server)
- Teknolojiler: Apollo Server, Node.js, Express, GraphQL, MongoDB, Redis, PostgreSQL

### GQL (./lib/gql/)

- GraphQL şema ve tipleri
- [Repository](https://github.com/lang-assist/gql)
- Teknolojiler: GraphQL SDL

### Design System (./design/)

- Tasarım sistemi ve UI pattern'ler
- [Repository](https://github.com/lang-assist/design)
- Teknolojiler: Figma, Flutter, Vue.js, TailwindCSS

### Documentation (./docs/)

- Platform dokümantasyonu
- [Repository](https://github.com/lang-assist/docs)
- Teknolojiler: Markdown, Mermaid, Drawio

## Kurulum

1. Repository'yi klonlayın:

```bash
git clone --recursive https://github.com/lang-assist/lang-assist.git
```

2. Submodülleri güncelleyin:

```bash
git submodule update --init --recursive
```

## Geliştirme

Her alt proje kendi repository'sinde geliştirilir. Değişikliklerinizi ilgili repository'de yapın ve ana repository'deki submodülleri güncelleyin.

## Lisans

Bu proje MIT lisansı altında lisanslanmıştır.
