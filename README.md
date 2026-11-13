# Registro

Web app per registrare ogni giorno entrate, uscite e varie della parrucchieria, con riepiloghi mensili,
dashboard annuale e calcolo dell'IVA. Sostituisce il vecchio registro Excel e ne mantiene la logica.

- **Oggi**: inserimento del giorno (contanti, carta, varie, uscite per categoria) con il totale in tempo reale.
- **Mese**: calendario o tabella dei giorni, giorni da compilare evidenziati, riepilogo e grafici del mese.
- **Dashboard**: indicatori dell'anno o di un periodo scelto, tabella mensile, confronto con l'anno precedente, 4 grafici.
- **Impostazioni**: aliquota e modalità IVA, categorie di uscita, giorni di chiusura, import ed export.

## Dove stanno i dati

L'app è pubblica su GitHub Pages ma **non contiene dati**. Entrate e uscite sono salvate nel file
`data/db.json` di un **repository GitHub privato** dedicato, `registro-data`, separato da tutti gli altri
progetti.

Si accede con **una password**. La password sblocca il token di accesso al repository dei dati, salvato
**cifrato** nel file pubblico `public/accesso.json` (AES-256-GCM, chiave derivata dalla password con
PBKDF2-SHA256 a 600.000 iterazioni). Senza la password il file non rivela nulla: né il token né dove sono i
dati. Le persone autorizzate sono al massimo due, ognuna con la propria password.

L'app tiene anche una copia locale (IndexedDB): si apre subito e funziona senza connessione. Le modifiche
fatte offline vengono inviate appena torna internet. Se due dispositivi salvano nello stesso momento, i dati
vengono uniti senza perdere nulla; se lo stesso giorno è stato modificato su entrambi, vince l'ultimo
dispositivo che salva e l'app lo segnala.

## Configurare l'accesso (una volta, per chi gestisce l'app)

1. **Crea il repository dei dati.** <https://github.com/new> → nome `registro-data` → **Private** → spunta
   **Add a README file** → crea.
2. **Crea il token.** <https://github.com/settings/personal-access-tokens/new>:
   - nome: `registro-app`, scadenza: ad esempio 1 anno
   - **Repository access** → _Only select repositories_ → solo `registro-data`
   - **Permissions** → _Repository permissions_ → **Contents: Read and write**
   - **Generate token** e copia il valore (`github_pat_…`)
3. **Crea il file di accesso.** Apri l'app → **Configura l'accesso** → inserisci proprietario, repository e
   token → **Verifica il repository**. Scrivi il nome di ogni persona (massimo 2): l'app genera per ciascuna
   una password di 20 caratteri. Premi **Crea il file di accesso**: viene scaricato `accesso.json`.
4. **Pubblica il file**: copialo in `public/accesso.json` e pubblica l'app (push su `main`).
5. **Consegna le password**: ogni persona salva la sua nell'app **Password** dell'iPhone (o in un gestore di
   password). L'app non conserva le password: se si chiude la pagina non si possono rivedere.

### Accedere

Apri l'app → **Nome** e **Password** → **Accedi**. Sull'iPhone il portachiavi propone nome e password
salvati e li inserisce con Face ID. Si accede una volta per dispositivo.

### Rinnovare il token, cambiare persone o password

Ripeti il punto 3 con il nuovo token. Per non cambiare le password, scrivi nei campi le password già in uso;
per togliere l'accesso a una persona, non includerla e **revoca il vecchio token** su GitHub (chi ha già
effettuato l'accesso lo ha visto sul proprio dispositivo). Poi pubblica il nuovo `accesso.json`.

### Accesso d'emergenza

Dalla schermata di accesso, **Accedi con il token** permette di entrare inserendo direttamente proprietario,
repository e token.

## Importare il vecchio Excel

1. Impostazioni → **Import ed export** → **Scarica backup completo** (consigliato prima di ogni import).
2. **Importa dal registro Excel** e scegli il file `.xlsx`.
3. L'anteprima mostra i giorni nuovi, quelli già presenti e identici (ignorati) e quelli già presenti ma
   diversi. Questi ultimi si sovrascrivono solo se scegli **Importa e sovrascrivi**.

L'import legge i fogli Gennaio … Dicembre, riconosce le colonne dall'intestazione, salta le righe vuote e la
riga TOTALI. Ogni cella di uscita diventa una voce della sua categoria.

## Backup ed export

Da Impostazioni → **Import ed export**:

- **Scarica backup completo**: un file JSON con tutto (giorni, uscite, categorie, impostazioni). Con
  **Ripristina da backup** lo ricarichi; l'app chiede conferma perché sostituisce tutti i dati.
- **Scarica Excel**: un anno con la stessa struttura del registro originale (fogli mensili + Dashboard
  Annuale) e formule vere. L'aliquota IVA è nella cella B12 della Dashboard.
- **Scarica CSV movimenti**: una riga per ogni entrata e uscita, apribile in Excel.

Anche il repository privato è un backup: GitHub conserva ogni versione di `data/db.json` nella cronologia.

## Installare l'app sul telefono

### iPhone (consigliato)

1. Apri l'indirizzo dell'app in **Safari**.
2. Tocca **Condividi** → **Aggiungi alla schermata Home**.
3. Apri il Registro **dall'icona** ed esegui lì l'accesso con nome e password.

Conviene installarla prima di accedere: su iPhone Safari e l'app installata non condividono i dati salvati,
quindi l'accesso va fatto nell'app installata. Inoltre Safari cancella i dati dei siti non installati dopo
qualche giorno di inutilizzo, mentre l'app installata no.

Uso con una mano:

- in **Oggi** scorri a destra o a sinistra sulla data o sul totale per passare al giorno prima o dopo;
- con la tastiera aperta il pulsante **Salva** resta sopra la tastiera;
- dalla data del giorno, **Calendario di …** riporta al mese; la scheda **Mese** riapre l'ultimo mese
  visto (l'app installata non ha il tasto Indietro).

### Android (Chrome)

Apri l'indirizzo dell'app → menu ⋮ → **Installa app** (o _Aggiungi a schermata Home_).

Dopo il primo avvio l'app funziona anche offline. Quando esce una nuova versione compare un avviso con il
pulsante **Aggiorna**.

## Regole di calcolo

- Tutti gli importi sono gestiti in centesimi interi e mostrati con 2 decimali (`€ 1.234,56`).
- **Varie**: conta in Totale entrate, Ricavo netto e grafici, ma è esclusa da imponibile e IVA.
- **IVA in scorporo** (predefinita): contanti e carta sono importi lordi. Imponibile = (contanti + carta) /
  (1 + aliquota), IVA = lordo − imponibile.
- **IVA in aggiunta** (come il vecchio Excel): IVA = (contanti + carta) × aliquota.
- L'IVA si calcola sul totale del periodo e si arrotonda al centesimo.
- **Fatturato dichiarato** = imponibile. **Ricavo netto** = entrate − uscite. **Netto dopo IVA** = ricavo
  netto − IVA.
- **Incasso medio giornaliero** = somma dei giorni con entrate / numero di quei giorni.

## Sviluppo

Requisiti: Node.js 22 o successivo.

```bash
npm install
```

```bash
npm run dev
```

Apre l'app su <http://localhost:5173>. In sviluppo la schermata di accesso offre anche **Prova senza
account**, con i dati salvati solo nel browser (non esiste nella versione pubblicata).

`npm run anteprima` crea la versione di produzione con **Prova senza account** e la serve anche sulla rete
di casa (porta 4173), per provarla dal telefono.

Comandi utili:

| Comando             | Cosa fa                                                 |
| ------------------- | ------------------------------------------------------- |
| `npm test`          | test della logica di calcolo, import ed export (Vitest) |
| `npm run e2e`       | test dei flussi principali nel browser (Playwright)     |
| `npm run typecheck` | controllo dei tipi TypeScript                           |
| `npm run lint`      | ESLint                                                  |
| `npm run build`     | build di produzione in `dist/`                          |

### Test di accettazione sul registro reale

`tests/unit/acceptance.test.ts` importa il registro reale e controlla i totali di gennaio, febbraio, aprile
e dell'anno (entrate, uscite, IVA in scorporo e in aggiunta, incasso medio, % varie, uscite per categoria).
Il file contiene dati reali e **non è nel repository**: per eseguirli copialo in
`tests/fixtures/private/registro.xlsx` (cartella esclusa da git). Senza il file questi test vengono
saltati.

### Struttura

```
src/
  domain/     tipi del modello dati e valori predefiniti
  lib/        calc.ts (calcoli puri), money.ts, dates.ts, colors.ts
  data/       RemoteRepository, repository GitHub privato, cache IndexedDB, fusione
  io/         import Excel, export Excel, backup JSON, CSV
  state/      DataContext (sincronizzazione), tema, categorie
  features/   oggi, mese, dashboard, impostazioni, connessione
  components/ interfaccia comune e grafici
tests/
  unit/       Vitest
  e2e/        Playwright
```

L'archivio dei dati passa dall'interfaccia `RemoteRepository` (`src/data/repository.ts`): per spostare i
dati su un altro backend, ad esempio SQLite con un'API su un server di casa, basta una nuova
implementazione, senza toccare le schermate.

### Pubblicazione

Ogni push sul ramo `main` esegue controlli, test e build con GitHub Actions
(`.github/workflows/deploy.yml`) e pubblica `dist/` su GitHub Pages. Il percorso base viene ricavato dal
nome del repository.
