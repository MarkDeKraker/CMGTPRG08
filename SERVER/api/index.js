const express = require("express");
const { ChatOpenAI } = require("@langchain/openai");
const {
  HumanMessage,
  AIMessage,
  SystemMessage,
} = require("@langchain/core/messages");
const { ChatMessageHistory } = require("langchain/stores/message/in_memory");
const { APIChain } = require("langchain/chains");

const {
  ChatPromptTemplate,
  MessagesPlaceholder,
} = require("@langchain/core/prompts");

// Config
const cors = require("cors");
const app = express()
  .use(express.json())
  .use(cors())
  .use(express.urlencoded({ extended: true }));
const port = 3000;
let tokenUsage = {};

// Chatmodel
const chat = new ChatOpenAI({
  azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY,
  azureOpenAIApiVersion: process.env.OPENAI_API_VERSION,
  azureOpenAIApiInstanceName: process.env.INSTANCE_NAME,
  azureOpenAIApiDeploymentName: process.env.ENGINE_NAME,
  callbacks: [
    {
      handleLLMEnd(output) {
        tokenUsage = output.llmOutput;
      },
    },
  ],
});

// Prompt enigneering voor de Chat. Op deze manier weet de chat over wat voor context hij moet praten.
const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "Als AI-assistent ben ik gespecialiseerd in het verstrekken van informatie over auto's. Om je zo goed mogelijk van dienst te zijn, heb ik een kentekenplaat nodig met de streepjes ertussen. Deze informatie stelt me in staat om nauwkeurige en relevante gegevens op te halen die je kunnen helpen bij je vragen en behoeften met betrekking tot auto's. Zodra je het kenteken verstrekt, zal ik grondig zoeken naar alle beschikbare gegevens om je vragen adequaat te beantwoorden. Voel je vrij om alle vragen te stellen die nodig zijn, zodat ik een volledig begrip kan krijgen van het onderwerp en jouw specifieke situatie. Ik ben er om je te helpen! Als er een vraag wordt gesteld over iets wat buiten voertuigen ligt moet je reageren dat je alleen beschikbaar bent voor vragen over voertuigen.",
  ],
  new MessagesPlaceholder("messages"),
]);

// Voeg de prompt engineering toe aan de chain
const chain = prompt.pipe(chat);

// Functie om kentekens te vinden in een tekst en deze terug te geven om te gebruiken om een API call uit te voeren.
const findLicensePlate = (text) => {
  const cleanedText = text.replace(/-/g, "");

  const licensePlateRegex =
    /\b\d?[A-Za-z]{1,3}-?\d{1,3}-?[A-Za-z]{0,2}\b|\b[A-Za-z]{2}\d{2}[A-Za-z]{2}\b|\b\d{1,2}-?[A-Za-z]{1,3}-?\d{1,2}\b/g;

  // Zoek naar kentekenpatronen in de tekst
  const match =
    (cleanedText.match(licensePlateRegex) || [])[0]?.toUpperCase() || null;

  return match;
};

// Functie die de RDW api aanroept met een kenteken die verkregen is uit de tekst van de gebruiker
const fetchRdwData = async (licensePlate) => {
  const apiUrl = `${process.env.RDW_API_BASE}?kenteken=${licensePlate}`;

  const requestOptions = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  };

  const data = await fetch(apiUrl, requestOptions)
    .then((response) => {
      return response.json();
    })
    .then((data) => {
      return data;
    })
    .catch((error) => {
      console.error("Error:", error);
    });
  return data;
};

/**
 * Endpoint om chatgegevens te ontvangen en verwerken.
 * Deze endpoint accepteert een POST-verzoek met de chatgeschiedenis en verwerkt deze om een reactie te genereren.
 *
 * @param {Object} req - Het HTTP-verzoekobject.
 * @param {Object} res - Het HTTP-antwoordobject.
 * @returns {Object} - Een JSON-object met het reactiebericht en de bijgewerkte chatgeschiedenis, of een foutbericht als er een fout optreedt.
 */
app.post("/api/postData", async (req, res) => {
  try {
    // Config
    const chatMessageHistory = new ChatMessageHistory();
    const messages = req.body.chatHistory;
    let lastHumanMessage = null;

    // Voeg de messages toe aan de messagehistory van de LLM
    for (const message of messages) {
      switch (message.role) {
        case "human":
          lastHumanMessage = message;
          await chatMessageHistory.addMessage(new HumanMessage(message.text));
          break;
        case "ai":
          await chatMessageHistory.addMessage(new AIMessage(message.text));
        case "system":
          await chatMessageHistory.addMessage(new SystemMessage(message.text));
          break;
      }
    }

    // Voeg context toe aan de LLM over een auto door het opzoeken van het kenteken in de RDW api.
    if (lastHumanMessage) {
      const licensePlate = findLicensePlate(lastHumanMessage.text);
      if (licensePlate) {
        const rdwInfo = await fetchRdwData(licensePlate);
        if (rdwInfo) {
          const responseText = `Informatie gevonden voor kenteken ${licensePlate}: ${JSON.stringify(
            rdwInfo
          )}`;
          await chatMessageHistory.addMessage(new SystemMessage(responseText));

          messages.push({
            role: "system",
            text: responseText,
          });
        } else {
          await chatMessageHistory.addMessage(
            new SystemMessage("Geen informatie gevonden voor dit kenteken.")
          );
          messages.push({
            role: "system",
            text: "Geen informatie gevonden voor dit kenteken.",
          });
        }
      }
    }

    // Roep de LLM aan om een reactie geven op basis van de chathistory
    const responseMessage = await chain.invoke({
      messages: await chatMessageHistory.getMessages(),
    });

    // Geef de response, chathistory en tokenusage terug aan de client
    res.status(200).json({
      response: responseMessage,
      chatHistory: messages,
      tokenUsage,
    });
  } catch (error) {
    // Verstuur een foutmelding indien er iets foutgaat
    res.status(500).json({
      error: "Er is een fout opgetreden bij het verwerken van het verzoek.",
    });
  }
});

/**
 * Endpoint om een testverzoek naar de API-keten te sturen.
 * Deze endpoint accepteert een GET-verzoek om een testverzoek naar de API-keten te sturen en het resultaat te retourneren.
 *
 * @param {Object} req - Het HTTP-verzoekobject.
 * @param {Object} res - Het HTTP-antwoordobject.
 * @returns {Object} - Een JSON-object met het resultaat van het testverzoek.
 */
app.get("/api/testchain", async (req, res) => {
  const chain = APIChain.fromLLMAndAPIDocs(chat, openApiSpec, {
    lang: "nl",
  });
  const result = await chain.invoke({
    question: "Wat is de uitvoering voor voertuig met kenteken 8XBR35",
  });

  res.status(200).json({ result });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

var openApiSpec = `
openapi: 3.0.0
info:
  title: RDW Open Data API
  description: API voor het opvragen van voertuiginformatie van de RDW Open Data
  version: 1.0.0
servers:
  - url: https://opendata.rdw.nl
paths:
  /resource/m9d7-ebf2.json:
    get:
      summary: Voertuiginformatie opvragen
      description: Geeft voertuiginformatie terug van de RDW Open Data.
      parameters:
        - name: kenteken
          in: query
          description: Kentekennummer van het voertuig
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Succesvolle respons met voertuiginformatie
          content:
            application/json:
              schema:
                type: array
                items:
                  type: object
                  properties:
                    kenteken:
                      type: string
                      description: Kentekennummer van het voertuig
                    voertuigsoort:
                      type: string
                      description: Type voertuig
                    merk:
                      type: string
                      description: Merk van het voertuig
                    handelsbenaming:
                      type: string
                      description: Handelsnaam van het voertuig
                    vervaldatum_apk:
                      type: number
                      description: Vervaldatum van de APK keuring
                    datum_tenaamstelling:
                      type: number
                      description: Datum van eigendomsoverdracht
                    bruto_bpm:
                      type: number
                      description: Bruto BPM van het voertuig
                    inrichting:
                      type: string
                      description: Interieurtype van het voertuig
                    aantal_zitplaatsen:
                      type: number
                      description: Aantal zitplaatsen in het voertuig
                    eerste_kleur:
                      type: string
                      description: Primaire kleur van het voertuig
                    tweede_kleur:
                      type: string
                      description: Secundaire kleur van het voertuig
                    aantal_cilinders:
                      type: number
                      description: Aantal cilinders in de motor van het voertuig
                    cilinderinhoud:
                      type: number
                      description: Cilinderinhoud van het voertuig
                    massa_ledig_voertuig:
                      type: number
                      description: Leeggewicht van het voertuig
                    toegestane_maximum_massa_voertuig:
                      type: number
                      description: Toegestane maximale massa van het voertuig
                    massa_rijklaar:
                      type: number
                      description: Rijklaar gewicht van het voertuig
                    maximum_massa_trekken_ongeremd:
                      type: number
                      description: Maximale ongeremde sleepmassa
                    maximum_trekken_massa_geremd:
                      type: number
                      description: Maximale geremde sleepmassa
                    datum_eerste_toelating:
                      type: number
                      description: Datum van eerste registratie van het voertuig
                    datum_eerste_tenaamstelling_in_nederland:
                      type: number
                      description: Datum van eerste registratie in Nederland
                    wacht_op_keuren:
                      type: string
                      description: Wachten op keuring indicator
                    catalogusprijs:
                      type: number
                      description: Catalogusprijs van het voertuig
                    wam_verzekerd:
                      type: string
                      description: WAM verzekeringsindicator
                    aantal_deuren:
                      type: number
                      description: Aantal deuren van het voertuig
                    aantal_wielen:
                      type: number
                      description: Aantal wielen van het voertuig
                    afstand_hart_koppeling_tot_achterzijde_voertuig:
                      type: number
                      description: Afstand van hart van koppeling tot achterzijde van het voertuig
                    afstand_voorzijde_voertuig_tot_hart_koppeling:
                      type: number
                      description: Afstand van voorzijde van voertuig tot hart van koppeling
                    lengte:
                      type: number
                      description: Lengte van het voertuig
                    breedte:
                      type: number
                      description: Breedte van het voertuig
                    europese_voertuigcategorie:
                      type: string
                      description: Europese voertuigcategorie
                    europese_voertuigcategorie_toevoeging:
                      type: string
                      description: Toevoeging aan Europese voertuigcategorie
                    plaats_chassisnummer:
                      type: string
                      description: Plaats van het chassisnummer
                    technische_max_massa_voertuig:
                      type: number
                      description: Technische maximale massa van het voertuig
                    type:
                      type: string
                      description: Type van het voertuig
                    type_gasinstallatie:
                      type: string
                      description: Type gasinstallatie van het voertuig
                    typegoedkeuringsnummer:
                      type: string
                      description: Typegoedkeuringsnummer van het voertuig
                    variant:
                      type: string
                      description: Variant van het voertuig
                    uitvoering:
                      type: string
                      description: Uitvoering van het voertuig
                    volgnummer_wijziging_eu_typegoedkeuring:
                      type: number
                      description: Volgnummer wijziging EU-typegoedkeuring
                    vermogen_massarijklaar:
                      type: number
                      description: Vermogen massarijklaar van het voertuig
                    wielbasis:
                      type: number
                      description: Wielbasis van het voertuig
                    export_indicator:
                      type: string
                      description: Exportindicator van het voertuig
                    openstaande_terugroepactie_indicator:
                      type: string
                      description: Indicator voor openstaande terugroepacties
                    vervaldatum_tachograaf:
                      type: number
                      description: Vervaldatum van de tachograaf
                    taxi_indicator:
                      type: string
                      description: Taxi-indicator
                    maximum_massa_samenstelling:
                      type: number
                      description: Maximale massa van de samenstelling
                    aantal_rolstoelplaatsen:
                      type: number
                      description: Aantal rolstoelplaatsen in het voertuig
                    maximum_ondersteunende_snelheid:
                      type: number
                      description: Maximale ondersteunende snelheid van het voertuig
                    jaar_laatste_registratie_tellerstand:
                      type: number
                      description: Jaar van laatste registratie van de tellerstand
                    tellerstandoordeel:
                      type: string
                      description: Oordeel over de tellerstand
                    code_toelichting_tellerstandoordeel:
                      type: string
                      description: Code voor toelichting op de tellerstand
                    tenaamstellen_mogelijk:
                      type: string
                      description: Mogelijkheid tot tenaamstellen
                    vervaldatum_apk_dt:
                      type: string
                      format: date-time
                      description: Vervaldatum van de APK (Datumtijd)
                    datum_tenaamstelling_dt:
                      type: string
                      format: date-time
                      description: Datum van eigendomsoverdracht (Datumtijd)
                    datum_eerste_toelating_dt:
                      type: string
                      format: date-time
                      description: Datum van eerste registratie van het voertuig (Datumtijd)
                    datum_eerste_tenaamstelling_in_nederland_dt:
                      type: string
                      format: date-time
                      description: Datum van eerste registratie in Nederland (Datumtijd)
                    vervaldatum_tachograaf_dt:
                      type: string
                      format: date-time
                      description: Vervaldatum van de tachograaf (Datumtijd)
                    maximum_last_onder_de_vooras_sen_tezamen_koppeling:
                      type: number
                      description: Maximale belasting onder de vooras(sen) (tezamen)/koppeling
                    type_remsysteem_voertuig_code:
                      type: string
                      description: Code voor het type remsysteem van het voertuig
                    rupsonderstelconfiguratiecode:
                      type: string
                      description: Configuratiecode van het rupsonderstel
                    wielbasis_voertuig_minimum:
                      type: number
                      description: Minimale wielbasis van het voertuig
                    wielbasis_voertuig_maximum:
                      type: number
                      description: Maximale wielbasis van het voertuig
                    lengte_voertuig_minimum:
                      type: number
                      description: Minimale lengte van het voertuig
                    lengte_voertuig_maximum:
                      type: number
                      description: Maximale lengte van het voertuig
                    breedte_voertuig_minimum:
                      type: number
                      description: Minimale breedte van het voertuig
                    breedte_voertuig_maximum:
                      type: number
                      description: Maximale breedte van het voertuig
                    hoogte_voertuig:
                      type: number
                      description: Hoogte van het voertuig
                    hoogte_voertuig_minimum:
                      type: number
                      description: Minimale hoogte van het voertuig
                    hoogte_voertuig_maximum:
                      type: number
                      description: Maximale hoogte van het voertuig
                    massa_bedrijfsklaar_minimaal:
                      type: number
                      description: Minimale bedrijfsklare massa van het voertuig
                    massa_bedrijfsklaar_maximaal:
                      type: number
                      description: Maximale bedrijfsklare massa van het voertuig
                    technisch_toelaatbaar_massa_koppelpunt:
                      type: number
                      description: Technisch toelaatbare massa van het koppelpunt
                    maximum_massa_technisch_maximaal:
                      type: number
                      description: Maximale massa technisch maximaal
                    maximum_massa_technisch_minimaal:
                      type: number
                      description: Maximale massa technisch minimaal
                    subcategorie_nederland:
                      type: string
                      description: Subcategorie Nederland van het voertuig
                    verticale_belasting_koppelpunt_getrokken_voertuig:
                      type: number
                      description: Verticale belasting van het koppelpunt van het getrokken voertuig
                    zuinigheidsclassificatie:
                      type: string
                      description: Zuinigheidsclassificatie van het voertuig
                    registratie_datum_goedkeuring_afschrijvingsmoment_bpm:
                      type: number
                      description: Registratiedatum goedkeuring (moment van afschrijving BPM)
                    registratie_datum_goedkeuring_afschrijvingsmoment_bpm_dt:
                      type: string
                      format: date-time
                      description: Registratiedatum goedkeuring (moment van afschrijving BPM) (Datumtijd)
                    gem_lading_wrde:
                      type: number
                      description: Gemiddelde ladingwaarde van het voertuig
                    aerodyn_voorz:
                      type: string
                      description: Aerodynamische voorziening of uitrusting van het voertuig
                    massa_alt_aandr:
                      type: number
                      description: Additionele massa alternatieve aandrijving
                    verl_cab_ind:
                      type: string
                      description: Indicator voor verlengde cabine

`;
