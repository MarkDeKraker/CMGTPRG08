# Smart Technologies - Opdracht 1
Taalmodel

## Links
- Live applicatie: https://prg8client.vercel.app/

## Hoe installeer je het project

### Vereiste software
- NodeJS 20.11.0 (LTS)
- Visual Studio Code

### Clone het project

- Dit is de link naar het **[project](https://github.com/MarkDeKraker/CMGTPRG08.git)**

Pull het project naar je machine


### Projectsettings

Open het `.env.example` bestand en dupliceer deze in dezelfde map (Verander de naam van de nieuwe `.env.example` file naar `.env`) en vul de juiste informatie in die benodigd is. 


#### Installatie van het project
Voer de volgende commandos uit voor de SERVER en CLIENT

```bash
cd SERVER/ClIENT
```

```bash
npm install
```

```bash
npm run dev
```

De client en server dienen beiden aan te staan voor de werking van de applicatie. 

Navigeer naar http://localhost:3000 en je zal hier de gebruikersinterface zien van de chatbot.

**Gefeliciteerd, de installatie is geslaagd!**

### Eventuele issues die kunnen optreden
- Onjuiste API keys voor de ChatLLM, hierdoor kunnen er geen calls gemaakt worden.
- De SERVER & CLIENT staan beide niet aan, beide services moeten aanstaan voor de werking van de applicatie.
- Het taalmodel van OpenAI kan soms niet werken door een overload bij het bedrijf zelf.
