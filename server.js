const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
require("dotenv").config();

const app = express(); // Initialize app first

app.use(cors({ // Use CORS middleware
  origin: "*", // Allow requests from your frontend
  credentials: true,
}));

// Firebase Admin SDK initialization
try {
  const serviceAccount = {
    type: process.env.FIREBASE_TYPE,
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: process.env.FIREBASE_AUTH_URI,
    token_uri: process.env.FIREBASE_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL,
    client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://todo-1266a-default-rtdb.firebaseio.com", // Ensure the URL is correct
  });
} catch (error) {
  console.error("Error initializing Firebase Admin SDK:", error);
  process.exit(1); // Exits on failure
}

const db = admin.firestore(); // Initialize Firestore

// Fetch all users
app.get("/users", async (req, res) => {
  try {
    const listUsersResult = await admin.auth().listUsers();
    const users = listUsersResult.users.map((user) => ({
      id: user.uid,
      email: user.email,
      password: user.passwordHash,
      signupTime: new Date(user.metadata.creationTime).toLocaleString(),
      ip: user.customClaims?.ip || "192.108.100.1",
    }));
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).send("Error fetching users.");
  }
});

// Route to fetch task lists
app.get("/tasklists", async (req, res) => {
  try {
    const listUsersResult = await admin.auth().listUsers();
    const users = await Promise.all(
      listUsersResult.users.map(async (user) => {
        const userId = user.uid;

        const todoListsCollection = db.collection("users").doc(userId).collection("todoLists");

        const todoListsSnapshot = await todoListsCollection.get();
        let totalTask = 0;

        const todoListsWithTasks = await Promise.all(
          todoListsSnapshot.docs.map(async (todoListDoc) => {
            const todoListData = todoListDoc.data();
            const taskListName = todoListData.name || "Untitled";
            const createdAt = todoListData.createdAt || "N/A";

            const tasksCollection = todoListDoc.ref.collection("tasks");
            const tasksSnapshot = await tasksCollection.get();
            const noOfTasks = tasksSnapshot.size;
            totalTask += noOfTasks;

            const tasks = tasksSnapshot.docs.map((taskDoc) => {
              const taskData = taskDoc.data();
              return {
                taskId: taskDoc.id,
                title: taskData.title || "Untitled",
                description: taskData.description || "No description",
                createdAt: taskData.createdAt || "N/A",
              };
            });

            return {
              todoListId: todoListDoc.id,
              name: taskListName,
              createdAt: createdAt,
              updatedAt: createdAt,
              no_of_tasks: noOfTasks,
              tasks: tasks,
            };
          })
        );

        return {
          id: userId,
          email: user.email,
          password: user.passwordHash,
          todoLists: todoListsWithTasks,
          TotalTask: totalTask,
        };
      })
    );

    res.json(users);
  } catch (error) {
    console.error("Error fetching users and tasks:", error);
    res.status(500).send("Error fetching task lists.");
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
