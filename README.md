
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


