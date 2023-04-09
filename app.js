const express = require("express");
const ejs = require("ejs");
const path = require("path");
const mongoose = require("mongoose");

// Init express
const app = express();
const port = process.env.PORT || 3000;

// Configure environment variables
require("dotenv").config();

// Set static folder
app.use(express.static(path.join(__dirname, "public")));

app.use(express.urlencoded({ extended: true }));

// Set the view engine to ejs
app.set("view engine", "ejs");

// Connect to database
mongoose
  .connect(process.env.DB_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    autoIndex: false,
    dbName: "pain-tea-blog",
  })
  .then(() => console.log("Connected to database."))
  .catch((err) => console.error(err));

// Define schema
const articleSchema = new mongoose.Schema({
  title: String,
  subtitle: String,
  author: String,
  article: String,
  date: Date,
});

const Article = mongoose.model("Article", articleSchema);

//Routes
// Render home page
app.get("/", (request, response) => {
  Article.find({})
    .then((articles) => {
      console.log(articles);
      response.render("index", { posts: articles });
    })
    .catch((err) => console.log(err));
});

// Render blog page
app.get("/blog/:id", (request, response) => {
  Article.findById(request.params.id)
    .then((article) => {
      console.log(article);
      response.render("blog", { post: article });
    })
    .catch((err) => console.log(err));
});

// Render new blog form
app.get("/new", (req, res) => {
  res.render("new");
});

// Post data to mongodb
app.post("/add", (req, res) => {
  const { title, subtitle, author, article } = req.body;
  const newArticle = new Article({
    title,
    subtitle,
    author,
    article,
    date: new Date(),
  });

  newArticle
    .save()
    .then((article) => {
      console.log(article);
      console.log("Data inserted successfully.");
    })
    .catch((err) => console.log(err));

  res.send("Article uploaded successfully.");
});

// Start the server
app.listen(port, () => console.log(`Server running on port ${port}.`));
