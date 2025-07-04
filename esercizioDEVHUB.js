const express = require('express')
const { MongoClient, ServerApiVersion } = require('mongodb')
const cors = require('cors')
const bodyParser = require('body-parser')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const app = express()

//middlewares per la gestione delle richieste in entrata
app.use(express.json())
//aggiungiamo le regole per non far subire dei controlli di autorizzazione da parte dei browser (=supera i controlli e vai comunque)
app.use(bodyParser.json());
app.use(cors())

const config = {
  PORT: 3000,
  TOKEN_SIGN_KEY: '<chiave per firma token>',
  MONGODB_URI: `mongodb+srv://saracrispino:1bPydWVj9wIQzFWe@demonodejs.jbpaovs.mongodb.net/?retryWrites=true&w=majority&appName=DemoNodeJS`,
  MONGODB_DB: 'sample_mflix'
}

// Creazione oggetto di connessione a mongodb
const client = new MongoClient(config.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
})

//middleware controllo validità token - eseguito per tutte le richieste ricevute indistintamente dal path
app.use(function (req, res, next) {  //next = se ti chiamo vai avanti con cosa deve succedere in base alla richiesta che ho ricevuto
  //escludo rotte che non devono essere sotto autenticazione
  if (req.originalUrl === '/login' || req.originalUrl === '/addUser') { //se si chiama login o addUser vai avanti
    return next()
  }
  if (req.headers.authorization && req.headers.authorization.length > 0 && req.headers.authorization.split(' ')[0] === 'Bearer') {
    // lettura token presente nel header "authorization" della richiesta http
    const token = req.headers.authorization.split(' ')[1]
    try {
      //verifica e recupero contenuto token ricevuto
      const decoded = jwt.verify(token, config.TOKEN_SIGN_KEY)
      //salvataggio contenuto del token in un campo del oggetto json della richiesta http ricevuta in modo da averlo disponibile all'interno del codice che risponde alla richiesta
      req.user = decoded
      //procedo con il richiamo del codice della richiesta effettiva
      next()
    } catch (err) {
      console.error(err)
      //risposta in caso di errore nella validazione del token
      res.status(403).json({ rc: 1, msg: err.toString() })
    }
  } else {
    //risposta in caso di assenza del token nella richiesta
    res.status(400).json({ rc: 1, msg: 'Missing token in request' })
  }
})

// Effettua il login con le credenziali fornite nel body della richiesta 
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    // connessione a mongodb
    await client.connect()
    // imposto il db in cui devo effettuare la query
    const db = client.db(config.MONGODB_DB)
    // cerco se esite già un utente con lo username che ho ricevuto
    //const user = await db.collection('users').findOne({ username: username }); //commento per fare i test
    // in caso non esiste rispondo alla richiesta indicando che l'utente non esiste
    //if (!user) return res.status(404).json({ rc: 1, msg: `User ${username} not found` }); //commento per fare i test

    // controllo che la password ricevuta nella richiesta corrisponda a quella salvata sul database
    //const match = await bcrypt.compare(password, user.password); //commento per fare i test
    // in caso non corrispondesse rispondo alla richiesta indicando che le credenziali ricevute non sono valide
    //if (!match) return res.status(401).json({ rc: 1, msg: 'Invalid credentials' }) //commento per fare i test
    //se sono arrivato qui vuol dire che i controlli precedenti sono stati superati
    const content = { username }
    // genero quindi un token e gli imposto una durata di validità (1 ora in questo caso)
    const token = jwt.sign(content, config.TOKEN_SIGN_KEY, {expiresIn: '1h'})
    // invio la risposta alla richiesta con il token
    res.status(200).json({ rc: 0, msg: 'Login successful', token: token });
  } catch (err) {
    console.error(err)
    res.status(500).json({ rc: 1, msg: err.toString() })
  } finally {
    // sia con che senza errori chiudo la connessione a mongodb
    await client.close()
  }
})

// Creazione di un nuovo utente con le credenziali fornite nel body della richiesta
app.put('/addUser', async (req, res) => {
  try {
    // leggo i parametri (obbligatori) username (name nel db), password e email ricevuti nel body della richiesta
     const{username}=req.body;
     console.log('username:', username);
     const{email}=req.body;
     console.log('email:', email);
     const{password}=req.body;
     console.log('password:', password);
     //per evitare di scrivere tre volte questi campi si può anche scrivere const { username, email, password } = req.body;

    // apro la connessione a mongodb
    await client.connect()
    const db = client.db(config.MONGODB_DB); 
    
    //controllo che i dati siano stati inseriti
    if (!username || !password || !email) return res.status(400).json({ rc: 1, msg: 'Missing one or more required fields: username, password, email' });

    // controllo se esiste già un utente con lo stesso username e se esiste rispondo con un messaggio di errore adeguato
    const usernameEsistente = await db.collection('users').findOne({ name: username });
    if (usernameEsistente) return res.status(400).json({ rc: 1, msg: `Username '${username}' is already taken` });
    
    // effettuo lo stesso controllo anche per il campo email
    const emailEsistente = await db.collection('users').findOne({ email: email });
    if (emailEsistente) return res.status(400).json({ rc: 1, msg: `Email '${email}' is already registered` });

    //per non mettere la password in chiaro utilizziamo bycript
    const pwdNascosta = await bcrypt.hash(password, 10);

    // se supero i controlli precedenti allora posso inserire il nuovo utente nel database
    // effettua la insert sulla collection users e invia la risposta alla richiesta 
    const addUser = await db.collection("users").insertOne({"name": username, "email": email, "password": pwdNascosta});

    res.status(201).send({ rc: 0, msg: `User ${username} added successfully` })
  } catch (err) {
    console.error(err)
    res.status(500).json({ rc: 1, msg: err.toString() })
  } finally {
    await client.close()
  }
})

// Aggiunta di un nuovo film con i dati forniti nel body della richiesta
app.post('/addFilm', async (req, res) => {
  try {
     // leggo i parametri (obbligatori) title, director e year ricevuti nel body della richiesta
     const {title, director, year} = req.body;
     //const{title}=req.body;
     console.log('titolo:', title);
     //const{director}=req.body;
     console.log('regista:', director);
     //const{year}=req.body;
     console.log('anno:', year);

     // se i parametri non sono tutti correttamente valorizzati rispondo con un messaggio di errore adeguato
    if (!title || !director || !year) return res.status(400).json({ rc: 1, msg: 'Missing one or more required fields: title, director, year' });

     // apro la connessione a mongodb
     await client.connect()
     const db = client.db(config.MONGODB_DB)
     // inserisco il nuovo film nella collection movies
     const addFilm = await db.collection("movies").insertOne({"title": title, "director": director, "year": year});

    //if (addFilm) return res.status(201).send({ rc: 0, msg: `Film ${title} added successfully` }) //insertOne restituisce sempre un oggetto, quindi sarebbe sempre entrato nell'if
    if (addFilm.acknowledged) return res.status(201).send({ rc: 0, msg: `Film '${title}' added successfully`, id: addFilm.insertedId }); //restituiamo l'id appena creato per fare in modo che sia più facile trovarlo nel db
     else return res.status(500).json({ rc: 1, msg: 'Failed to insert film' });
    
  } catch (err) {
    console.error(err)
    res.status(500).json({ rc: 1, msg: err.toString() })
  } finally {
    await client.close()
  }
})

// ritorna una lista filtrata di film  
app.get('/listMovies', async (req, res) => {
    // leggo i filtri ricevuti nel body della richiesta in formato json
    const{title}=req.query;
    console.log(title);
    // apro la connessione a mongodb
    await client.connect();
    // imposto il database su cui voglio lavorare
    const db = client.db(config.MONGODB_DB)
    // effettuo la query e recupero i primi 50 record che trovo, ordinati in maniera decrescente per campo _id
    const listFilm = db.collection("movies").find({"title": {"$regex": title, "$options": "i" }}).sort({"_id" : -1}).limit(50).toArray();
    // rispondo alla richiesta ritornando un campo data nel body della risposta che contiene i record recuperati dalla query
    if (listFilm) return res.status(200).json({ rc: 0, data: await(listFilm) })
      //bisogna trovare un modo per restituire a video il fatto che non si sia trovato un titolo
    //res.json({rc: 0, msg: 'Film trovati'})  
})

// attivazione web server in ascolto sulla porta indicata
app.listen(config.PORT, () => {
  console.log(`Movie Manager app listening on port ${config.PORT}`)
})