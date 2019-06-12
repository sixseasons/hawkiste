// https://github.com/MediaSystems/aprg/blob/master/UserManagement/server.js

const express = require('express');
const app = express();

app.use(express.static(__dirname + '/stylings'));
app.use(express.static(__dirname + '/public'));

const session = require('express-session');
app.use(session({
    secret: 'example',
    resave: false,
    saveUninitialized: true
}));

app.engine('.ejs', require('ejs').__express);
app.set('view engine', 'ejs');


const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({extended: true}));

/*
const fileUpload = require('express-fileupload');
app.use(fileUpload());
*/


//https://github.com/bradtraversy/nodeuploads/blob/master/app.js
const path = require('path');


const multer = require('multer');
const storage = multer.diskStorage({
    destination: './public/uploads/',
    filename: function(request, file, cb){
        cb(null, file.fieldname + '-' + Date.now() +
        path.extname(file.originalname));
    }
});


// Upload
const upload = multer({
    storage: storage,
    limits:{fileSize: 1000000},
    fileFilter: function(request, file, cb){
        checkFileType(file, cb);
    }
}).single('bild');
  
// Check File Type
function checkFileType(file, cb){
    // Allowed ext
    const filetypes = /jpeg|jpg|png/;
    // Check ext
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    // Check mime
    const mimetype = filetypes.test(file.mimetype);
    
    if(mimetype && extname){
        return cb(null,true);
    } else {
        cb('Error: Nur jpeg, jpg, oder png!');
    }
};

app.post('/upload', (request, response) => {
    upload(request, response, (error) => {
        if(error){
            response.render('anzeigeErstellen', {
                msg: error
            });
        } else {
            if(request.file == undefined){
                response.render('anzeigeErstellen', {
                    msg: 'Error: Kein Bild ausgewählt!'
                });
            } else {
                const sql = `INSERT INTO angebote (bild) VALUES (${request.file})`;
                console.log(sql);
                response.render('anzeigeErstellen', {
                    msg: 'Bild hochgeladen!',
                    file: `uploads/${request.file.filename}`
                });
            }
        }
    });
});

/*
app.post('/upload', upload.single('img'), function(req, res, next){
  console.log("file"+req.file+req.files);
  res.send('Successfully uploaded!');
});
*/

const sqlite3 = require('sqlite3').verbose();
let database = new sqlite3.Database('users.db'); 

const bcrypt = require('bcrypt');
const saltRounds = 8;


app.listen(3000, () => {
    console.log("Server ist auf 3000");

    database.each(`SELECT * FROM users`, (error, row) => {
        console.log(row);
    });
});


app.get('/', (request, response) => {
    let authenticated = request.session.authenticated;
    let nutzername = request.session.nutzername;

    let greeting = "Hi";
    if (!authenticated) {
        greeting = "HAW Kiste | Von und für Studenten der HAW";
    }
    else {
        greeting = `Willkommen, ${nutzername}!`;
    }

    response.render('index', {
        isLoggedIn: authenticated,
        greeting: greeting
    });
});

app.get('/login', (request, response) => {
    if (!request.session.authenticated) {
        response.render('login', {
            error: false
        });
    }
    else {
        response.redirect('/kiste');
    }
});

app.post('/login', (request, response) => {
    let nutzername = request.body.nutzername;
    let passwort = request.body.passwort;

    database.get(`SELECT * FROM users WHERE nutzername='${nutzername}'`, function(error, row) {
        if (error) {
            console.log(error);
            response.redirect('/login');
            return;
        }

        if (row != null) {
            bcrypt.compare(passwort, row.passwort, (error, result) => {
                if (error) {
                    console.log(error);
                    response.redirect('/login');
                    return;
                }

                if (result == true) {
                    request.session.authenticated = true;
                    request.session.nutzername = row.nutzername;
                    response.redirect('/kiste');
                }
                else {
                    response.render('login', {
                        error: true
                    });
                }
            });
        } 
        else {
            response.render('login', {
                error: true
            });
        }
    });
});

app.post('/logout', (request, response) => {
    request.session.destroy();
    response.redirect('/kiste');
});

app.get('/register', (request, response) => {
    if (!request.session.authenticated) {
        response.render('register', {
            error: null
        });
    }
    else {
        response.redirect('/kiste');
    }
});

app.post('/register', (request, response) => {
    let nutzername = request.body.nutzername;
    let passwort = request.body.passwort;
    let passwortConfirm = request.body.passwortConfirm;
    let email = request.body.email;

    if (passwort != passwortConfirm) {
        response.render('register', {
            error: "Passwörter müssen übereinstimmen!"
        });
        return;
    }

    database.get(`SELECT * FROM users WHERE nutzername='${nutzername}'`, function(error, row) {
        if (error) {
            console.log(error);
            response.redirect('/register');
            return;
        }

        if (row == null) {
            bcrypt.hash(passwort, saltRounds, (error, hash) => {
                if (error) {
                    console.log(error);
                    response.redirect('/register');
                    return;
                }

                database.run(`INSERT INTO users (nutzername, passwort, email) VALUES ('${nutzername}', '${hash}', '${email}')`, (error) => {
                    if (error) {
                        console.log(error);
                        response.redirect('/register');
                        return;
                    }
                });
                console.log(`User '${nutzername}' registered`);
                request.session.authenticated = true;
                request.session.nutzername = nutzername;
                response.redirect('/kiste');
            });
        }
        else {
            response.render('register', {
                error: "Benutzername bereits vorhanden."
            });
        }
    });
});


app.get('/anzeigeErstellen', (request, response) => {
    let permission = request.session.authenticated;
    if (!permission) {
        response.redirect('/bitteAnmelden', {
            error: "Bitte anmelden, um eine Anzeige zu erstellen."
            }, {
                isLoggedIn: permission, 
        });
    }
    else {
        response.render('anzeigeErstellen', {
            isLoggedIn: permission,
        });
    }
});


app.get('/bitteAnmelden', (request, response) => {
    if (!request.session.authenticated) {
        response.render('bitteAnmelden', {
            error: false
        });
    }
    else {
        response.redirect('/anzeigeErstellen');
    }
});


app.post('/bitteAnmelden', (request, response) => {
    let nutzername = request.body.nutzername;
    let passwort = request.body.passwort;

    database.get(`SELECT * FROM users WHERE nutzername='${nutzername}'`, function(error, row) {
        if (error) {
            console.log(error);
            response.redirect('/bitteAnmelden');
            return;
        }

        if (row != null) {
            bcrypt.compare(passwort, row.passwort, (error, result) => {
                if (error) {
                    console.log(error);
                    response.redirect('/bitteAnmelden');
                    return;
                }

                if (result == true) {
                    request.session.authenticated = true;
                    request.session.nutzername = row.nutzername;
                    response.redirect('/anzeigeErstellen');
                }
                else {
                    response.render('bitteAnmelden', {
                        error: true
                    });
                }
            });
        } 
        else {
            response.render('bitteAnmelden', {
                error: true
            });
        }
    });
});

/*
app.post("/upload", function(request, response){
    let bild = request.body.bild;
    console.log(bild);


    const sql = `INSERT INTO angebote (bild) VALUES (${bild})`;
    console.log(sql);
    database.run(sql, function(error){
    response.redirect("/kiste");
})
*/

/*
app.post('/upload', function(request, response) {
    if (Object.keys(request.files).length == 0) {
      return response.status(400).send('No files were uploaded.');
    }
  
    // The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file
    let bild = request.files.bild;
  
    // Use the mv() method to place the file somewhere on your server
    bild.mv(__dirname + '/public/' + bild.name, function(error) {
      if (error)
        return response.status(500).send(error);
    });

    const sql = `INSERT INTO angebote (bild) VALUES (${bild})`;
    console.log(sql);
    database.run(sql, function(error){
    response.redirect("/kiste");
    });

});
*/


//https://github.com/MediaSystems/aprg/blob/master/StudisZeigen/server.js
let dienstleistungen = [];
let fahrzeuge = [];
let immobilien = [];
let jobs = [];
let tiere = [];
let kleidung = [];
let moebel = [];
let elektronik = [];
let musikFilmeBuecher = [];
let ticketsKarten = [];
let zuVerschenken = [];
let alle = [];

app.post("/anzeigeErstellen", function(request, response){
	let name = request.body.name;
    let preis = request.body.preis;
    let beschreibung = request.body.beschreibung;
    let kategorie = request.body.kategorie;
    let ort = request.body.ort;
    let email = request.body.email;
	console.log(name);
    console.log(preis);
    console.log(beschreibung);
    console.log(kategorie);
    console.log(ort);
    console.log(email);

    const Objekt = {
        name: name,
        preis: preis,
        beschreibung: beschreibung,
        ort: ort,
        email: email
    };

    const sql = `INSERT INTO angebote (name, preis, beschreibung, kategorie, ort) VALUES ('${name}', ${preis}, '${beschreibung}', '${kategorie}', '${ort}')`;
    console.log(sql);



    database.run(sql, function(error){

       
        if (`'${kategorie}' === 'Dienstleistung'`){
            alle.push(Objekt)
            dienstleistungen.push(Objekt)
        }
    
        else if (`'${kategorie}' === 'Fahrzeuge'`){
            alle.push(Objekt)
            fahrzeuge.push(Objekt)
        }

        else if (`'${kategorie}' === 'Immobilien'`){
            immobilien.push(Objekt)
            alle.push(Objekt)
        }
    
        else if (`'${kategorie}' === 'Jobs'`){
            jobs.push(Objekt),
            alle.push(Objekt)
        }
    
        else if (`'${kategorie}' === 'Tiere'`){
            tiere.push(Objekt),
            alle.push(Objekt)
        }
    
        else if (`'${kategorie}' === 'Kleidung'`){
            kleidung.push(Objekt),
            alle.push(Objekt)
        }
    
        else if (`'${kategorie}' === 'Möbel'`){
            moebel.push(Objekt),
            alle.push(Objekt)
        }
    
        else if (`'${kategorie}' === 'Elektronik'`){
            elektronik.push(Objekt),
            alle.push(Objekt)
        }
    
        else if (`'${kategorie}' === 'Musik/Filme/Bücher'`){
            musikFilmeBuecher.push(Objekt),
            alle.push(Objekt)
        }
    
        else if (`'${kategorie}' === 'Tickets/Karten'`){
            ticketsKarten.push(Objekt),
            alle.push(Objekt)
        }
    
        else {
            zuVerschenken.push(Objekt),
            alle.push(Objekt)
        }

        response.redirect("/kiste");
    });


});

/*
    if(`'${kategorie}' = 'Immobilien'`){
        const wohnObject = {
            name: name,
            preis: preis,
            beschreibung: beschreibung,
            ort: ort
        };
        immobilien.push(wohnObject);
    }
    database.run(sql, function(error){
    response.redirect("/kiste");
    });


    if(`'${kategorie}' = 'Jobs'`){
        const jobObject = {
            name: name,
            preis: preis,
            beschreibung: beschreibung,
            ort: ort
        };
        jobs.push(jobObject);
    }
    database.run(sql, function(error){
    response.redirect("/kiste");
    });


    if(`'${kategorie}' = 'Tiere'`){
        const tierObject = {
            name: name,
            preis: preis,
            beschreibung: beschreibung,
            ort: ort
        };
        tiere.push(tierObject);
    }
    database.run(sql, function(error){
    response.redirect("/kiste");
    });


    if(`'${kategorie}' = 'Kleidung'`){
        const kleidObject = {
            name: name,
            preis: preis,
            beschreibung: beschreibung,
            ort: ort
        };
        kleidung.push(kleidObject);
    }
    database.run(sql, function(error){
    response.redirect("/kiste");
    });


    if(`'${kategorie}' = 'Möbel'`){
        const moebelObject = {
            name: name,
            preis: preis,
            beschreibung: beschreibung,
            ort: ort
        };
        moebel.push(moebelObject);
    }
    database.run(sql, function(error){
    response.redirect("/kiste");
    });


    if(`'${kategorie}' = 'Elektronik'`){
        const elektroObject = {
            name: name,
            preis: preis,
            beschreibung: beschreibung,
            ort: ort
        };
        elektronik.push(elektroObject);
    }
    database.run(sql, function(error){
    response.redirect("/kiste");
    });


    if(`'${kategorie}' = 'Musik/Filme/Bücher'`){
        const medienObject = {
            name: name,
            preis: preis,
            beschreibung: beschreibung,
            ort: ort
        };
        musikFilmeBuecher.push(medienObject);
    }
    database.run(sql, function(error){
    response.redirect("/kiste");
    });


    if(`'${kategorie}' = 'Tickets/Karten'`){
        const ticketObject = {
            name: name,
            preis: preis,
            beschreibung: beschreibung,
            ort: ort
        };
        ticketsKarten.push(ticketObject);
    }
    database.run(sql, function(error){
    response.redirect("/kiste");
    });


    if(`'${kategorie}' = 'Zu Verschenken'`){
        const geschenkObject = {
            name: name,
            preis: preis,
            beschreibung: beschreibung,
            ort: ort
        };
        zuVerschenken.push(geschenkObject);
    }
    database.run(sql, function(error){
    response.redirect("/kiste");
    });
*/

/*
    database.run(`INSERT INTO angebote (name, preis, bild, beschreibung, kategorie, ort)
    VALUES ('${name}', ${preis}, ${bild}, '${beschreibung}', '${kategorie}', '${ort}')`, (error) => {
        if (error) {
            console.log(error);
            response.redirect('/anzeigeErstellen');
            return;
        }
    })
    console.log(`'${name}', ${preis}, '${beschreibung}', '${kategorie}', '${ort}'`);
    response.redirect('/kiste');
*/






// Formularauswertung
app.get("/fahrzeuge", function(request, response){


    let permission = request.session.authenticated;

    response.render("fahrzeuge", {isLoggedIn: permission, list: fahrzeuge});
});

app.get("/immobilien", function(request, response){


    let permission = request.session.authenticated;

    response.render("immobilien", {isLoggedIn: permission, list: immobilien});
});

app.get("/dienstleistungen", function(request, response){


    let permission = request.session.authenticated;

    response.render("dienstleistungen", {isLoggedIn: permission, list: dienstleistungen});
});

app.get("/jobs", function(request, response){


    let permission = request.session.authenticated;

    response.render("jobs", {isLoggedIn: permission, list: jobs});
});

app.get("/tiere", function(request, response){


    let permission = request.session.authenticated;

    response.render("tiere", {isLoggedIn: permission, list: tiere});
});

app.get("/kleidung", function(request, response){


    let permission = request.session.authenticated;

    response.render("kleidung", {isLoggedIn: permission, list: kleidung});
});

app.get("/moebel", function(request, response){


    let permission = request.session.authenticated;

    response.render("moebel", {isLoggedIn: permission, list: moebel});
});

app.get("/elektronik", function(request, response){


    let permission = request.session.authenticated;

    response.render("elektronik", {isLoggedIn: permission, list: elektronik});
});

app.get("/musikFilmeBuecher", function(request, response){


    let permission = request.session.authenticated;

    response.render("musikFilmeBuecher", {isLoggedIn: permission, list: musikFilmeBuecher});
});

app.get("/ticketsKarten", function(request, response){


    let permission = request.session.authenticated;

    response.render("ticketsKarten", {isLoggedIn: permission, list: ticketsKarten});
});

app.get("/zuVerschenken", function(request, response){


    let permission = request.session.authenticated;

    response.render("zuVerschenken", {isLoggedIn: permission, list: zuVerschenken});
});



app.get("/kiste", function(request, response){


    let permission = request.session.authenticated;

    response.render("kiste", {isLoggedIn: permission, list: alle});
});







/*
app.get("/dienstleistungen", function(request, response){
    response.render('dienstleistungen');
});
*/