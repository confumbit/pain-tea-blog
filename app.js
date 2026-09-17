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
    ca: fs.readFileSync(path.join(__dirname, "ca.pem")),
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
      "SELECT * FROM articles WHERE status='approved' ORDER BY date DESC"
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

// Render blog submission form
app.get("/submission", (req, res) => {
  res.render("submission");
});

const axios = require("axios");
const FormData = require("form-data");

const cloudinary = require("cloudinary").v2;

// Configure Cloudinary with credentials
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Upload image to Cloudinary
async function uploadToCloudinary(imageBuffer) {
  try {
    // Convert Buffer to base64
    const base64Image = `data:image/png;base64,${imageBuffer.toString(
      "base64"
    )}`;

    // Upload image
    const result = await cloudinary.uploader.upload(base64Image, {
      folder: "uploads", // Optional: Set a folder name in Cloudinary
    });

    console.log(result.secure_url);
    return result.secure_url; // Return the image URL
  } catch (error) {
    console.error("Cloudinary upload error:", error);
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
  let authorImage = await uploadToCloudinary(req.files.authorImage.data);
  console.log(authorImage);
});

// Post data to PostgreSQL
// Handle new article submission with cloudinary upload
app.post("/add", async (req, res) => {
  const { title, subtitle, author, article } = req.body;
  let authorImage = null;

  if (req.files && req.files.authorImage) {
    const imageBuffer = req.files.authorImage.data;
    authorImage = await uploadToCloudinary(imageBuffer);
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
      "INSERT INTO articles (title, subtitle, author, article, date, author_image, status) VALUES ($1, $2, $3, $4, NOW(), $5, 'approved')",
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

app.post("/submit", async (req, res) => {
  const { title, subtitle, author, article, authorImageBase64 } = req.body;

  if (!title || !subtitle || !author || !article) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  let authorImage = null;

  // If a base64 image string is provided, upload it to Cloudinary
  if (authorImageBase64) {
    try {
      const formattedBase64 = `data:image/png;base64,${authorImageBase64}`;
      const result = await cloudinary.uploader.upload(formattedBase64, {
        folder: "uploads",
      });
      authorImage = result.secure_url;
    } catch (err) {
      console.error("Cloudinary upload error:", err);
      return res.status(500).json({ message: "Image upload failed" });
    }
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
      "INSERT INTO articles (title, subtitle, author, article, date, author_image, status) VALUES ($1, $2, $3, $4, NOW(), $5, 'pending')",
      [title, subtitle, author, article, finalImage]
    );

    res.redirect("/");
  } catch (err) {
    console.error("DB error:", err);
    res.status(500).json({ message: "Database insert failed" });
  }
});

app.post("/admin/approve/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("UPDATE articles SET status = 'approved' WHERE id = $1", [
      id,
    ]);
    res.redirect("/pending");
  } catch (error) {
    console.error("Approval error:", error);
    res.status(500).send("Approval failed");
  }
});

app.post("/admin/reject/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("UPDATE articles SET status = 'rejected' WHERE id = $1", [
      id,
    ]);
    res.redirect("/pending");
  } catch (error) {
    console.error("Rejection error:", error);
    res.status(500).send("Rejection failed");
  }
});

app.get("/pending", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM articles WHERE status = 'pending' ORDER BY date DESC"
    );
    res.render("pending", { posts: result.rows }); // Create `pending.ejs`
  } catch (error) {
    console.error("Error fetching pending articles:", error);
    res.status(500).send("Server error");
  }
});

// Start the server
app.listen(port, () => console.log(`Server running on port ${port}.`));
