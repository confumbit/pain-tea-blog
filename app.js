const express = require("express");
const ejs = require("ejs");
const path = require("path");
const { Pool } = require("pg");
require("dotenv").config();

// Init express
const app = express();
const port = process.env.PORT || 3001;

// Set static folder
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const fileUpload = require("express-fileupload");

app.use(fileUpload());

// Set the view engine to ejs
app.set("view engine", "ejs");

const fs = require("fs");
const pg = require("pg");
const url = require("url");

const config = {
  user: "avnadmin",
  password: process.env.DB_PASS,
  host: "pg-2365fd22-heatblast0044-2609.h.aivencloud.com",
  port: 15964,
  database: "defaultdb",
  ssl: {
    rejectUnauthorized: true,
    ca: `-----BEGIN CERTIFICATE-----
MIIETTCCArWgAwIBAgIUUrlCsDb6qtZRMTtmq8jM3oyERNswDQYJKoZIhvcNAQEM
BQAwQDE+MDwGA1UEAww1YWFiYjgwZjItYjhlZC00OTBiLWFjMDktZTUwYTg4YmI1
OGFlIEdFTiAxIFByb2plY3QgQ0EwHhcNMjUwMzE1MjAyMjQyWhcNMzUwMzEzMjAy
MjQyWjBAMT4wPAYDVQQDDDVhYWJiODBmMi1iOGVkLTQ5MGItYWMwOS1lNTBhODhi
YjU4YWUgR0VOIDEgUHJvamVjdCBDQTCCAaIwDQYJKoZIhvcNAQEBBQADggGPADCC
AYoCggGBALQCamGQ+vEDG8mUzjVW7nBw9zwKblVtn7g9DN5zyM4IMuNXTd+JsxCr
t6jL4rhoWUTWCQSSOEy3aK/MbRnGjahCVUS2Hfl0eigp+Xmm8+BWOCH10NhFXOR0
riWIXirfq71MiKOruyetNryC4jtEnMctSZjTFJUR+mL/a2eC/num4+L1br+HShEA
Rht4ejXf78mOQ3LRBnMzLR/G+aaXX/tTAP8vk9imUdqhuWc/bpJKt9UEBacffo0+
XVEBQWquP+VukUp5dt5Pj2FjMrM3IMwAl9zWVMhErsYFoAQ9U1ahAm3NrzDZvQwP
diBxG0R1i3SRe+YxXjs619SDitNSPPAXW9BjOTjgwVDVRrYvgic8YUH4ynnFx5mj
3UZxFVSKLWQV8rINS4vjYTNnPVcLSGeuqgco/HzM/bt180I3PZXuDfBwI0RNV8MC
vSZcKCqoDWuJk6Q5t6YSk6uTw7bL826uvzq5RQtYTxuzNVaHKAtcj2bTpKns7RXb
b2IwO4zR7QIDAQABoz8wPTAdBgNVHQ4EFgQUUXR1pgxBPV+VOlWDd2g/8WfFJHcw
DwYDVR0TBAgwBgEB/wIBADALBgNVHQ8EBAMCAQYwDQYJKoZIhvcNAQEMBQADggGB
AF3/p2XJgHkxj21cpcWaF4w4poTbsPGiwZh0wIu5oRHeP3v3EhcaUR1pHGJQLE/1
spLPcQfCgX6B0WISoXkZnZqW2LaJ67mh0QJ+47Ky2FcLEjHU4KMHogypp2Flmnrh
J1W+hOUpYNGTC202vqv0R6/Gqd4F1L5VYtLoQPyCJ8yYen7KDs4brbU41/YUhRnH
SJG6TMJSrgBVaIibH21fHudsIdcOIhh6S1+L7wzqZ0tORNmciAh5/VnwI9BR0VcD
3iT/A4uFaNKhh48wMOm0s8CioI5g2lRX9rATFvnL/RP/4xi5mmHp+nB+in9vKjXK
y+8kna8QXo/eXxlEU7Y0Ved09fE4rYdN2n6l7jK2Mnr0g8t5EQqteDWSKeH7c71O
CEBarq0Z3DEHqLA9rgmL90IdVHvKchtUhMN/r4bCkzHnWh09BbirsumWJUO3JzAz
JeeQUGbR7NZqiLw2mN36DYvrlIN09ozo1AVqCmSeRHuym2gPrrU5RutzlbxuCdky
8w==
-----END CERTIFICATE-----`,
  },
};

// Connect to PostgreSQL database
const pool = new Pool(config);

pool
  .connect()
  .then(() => console.log("Connected to PostgreSQL database."))
  .catch((err) => console.error("Database connection error:", err));

//Routes
// Render home page
app.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM articles ORDER BY date DESC"
    );
    res.render("index", { posts: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching articles");
  }
});

// Increase view count when an article is viewed
app.post("/blog/:id/view", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "UPDATE articles SET views = views + 1 WHERE id = $1 RETURNING views",
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Article not found" });
    }

    res.json({ message: "View count updated", views: result.rows[0].views });
  } catch (error) {
    console.error("Error updating view count:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// fetch blog page by id
app.get("/blog/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query("SELECT * FROM articles WHERE id = $1", [
      id,
    ]);
    if (result.rowCount === 0) return res.status(404).send("Article not found");

    const article = result.rows[0];

    await pool.query(
      "UPDATE articles SET views = views + 1 WHERE id = $1 RETURNING views",
      [id]
    );

    // Fetch comments for the article
    const commentsResult = await pool.query(
      "SELECT * FROM comments WHERE article_id = $1 ORDER BY date DESC",
      [id]
    );

    res.render("blog", { post: article, comments: commentsResult.rows });
  } catch (error) {
    console.error("Error fetching article:", error);
    res.status(500).send("Server error");
  }
});

// Render new blog form
app.get("/new", (req, res) => {
  res.render("new");
});

const axios = require("axios");
const FormData = require("form-data");

const IMGUR_CLIENT_ID = process.env.IMGUR_CLIENT_ID; // Store in .env

async function uploadToImgur(imageBuffer) {
  try {
    const formData = new FormData();
    formData.append("image", imageBuffer.toString("base64"));

    const response = await axios.post(
      "https://api.imgur.com/3/upload",
      formData,
      {
        headers: {
          Authorization: `Client-ID ${IMGUR_CLIENT_ID}`,
          ...formData.getHeaders(),
        },
      }
    );

    return response.data.data.link; // URL of the uploaded image
  } catch (error) {
    console.error("Imgur upload error:", error);
    return null;
  }
}

app.get("/author-image", async (req, res) => {
  const { author } = req.query;
  if (!author) return res.json({ image: null });

  try {
    const result = await pool.query(
      "SELECT author_image FROM articles WHERE author = $1 LIMIT 1",
      [author]
    );

    if (result.rows.length > 0) {
      res.json({ image: result.rows[0].author_image });
    } else {
      res.json({ image: null });
    }
  } catch (error) {
    console.error("Error fetching author image:", error);
    res.status(500).json({ image: null });
  }
});

app.post("/add_image", async (req, res) => {
  let authorImage = await uploadToImgur(req.files.authorImage.data);
  console.log(authorImage);
});

// Post data to PostgreSQL
// Handle new article submission with Imgur upload
app.post("/add", async (req, res) => {
  const { title, subtitle, author, article } = req.body;
  let authorImage = null;

  if (req.files && req.files.authorImage) {
    const imageBuffer = req.files.authorImage.data;
    authorImage = await uploadToImgur(imageBuffer);
  }

  try {
    // Check if author already has an image
    const existingAuthor = await pool.query(
      "SELECT author_image FROM articles WHERE author = $1 LIMIT 1",
      [author]
    );

    const finalImage =
      existingAuthor.rows.length > 0
        ? existingAuthor.rows[0].author_image
        : authorImage;

    await pool.query(
      "INSERT INTO articles (title, subtitle, author, article, date, author_image) VALUES ($1, $2, $3, $4, NOW(), $5)",
      [title, subtitle, author, article, finalImage]
    );

    console.log("Article inserted successfully.");
    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error saving article");
  }
});

app.get("/blog/:id/comments", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "SELECT * FROM comments WHERE article_id = $1 ORDER BY date DESC",
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching comments:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/blog/:id/comments", async (req, res) => {
  const { id } = req.params;
  const { name, comment } = req.body;

  if (!name || !comment) {
    return res.status(400).json({ message: "Name and comment are required" });
  }

  try {
    await pool.query(
      "INSERT INTO comments (article_id, name, comment, date) VALUES ($1, $2, $3, NOW())",
      [id, name, comment]
    );
    res.json({ message: "Comment added successfully" });
  } catch (error) {
    console.error("Error adding comment:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Start the server
app.listen(port, () => console.log(`Server running on port ${port}.`));
