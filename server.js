const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");

const app = express();
const PORT = process.env.PORT || 3000;
const REPO_NAME_PREFIX = process.env.REPO_NAME_PREFIX;

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
if (!GITHUB_TOKEN) {
    console.error("Error: GITHUB_TOKEN is not set!");
    process.exit(1);
}
const ORG_NAME = "jhu-ip"; 
const STAFFTEAM = process.env.STAFF_TEAM_NAME;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/config", (req, res) => {
  res.json({
    MIDTERM_PROJECT: process.env.MIDTERM_PROJECT === "true"
  });
});

function saveSubmissionToCSV(teamData) {
    const csvPath = path.join(__dirname, "results.csv");
    const timestamp = new Date().toISOString();
    let lines = [];

    if (!fs.existsSync(csvPath)) fs.writeFileSync(csvPath, ""); 

    const teamCounter = fs.readFileSync(csvPath, "utf8").split("TEAM").length - 1;
    lines.push(`TEAM ${teamCounter}`);

    Object.keys(teamData).forEach(key => {
        const member = teamData[key];
        if (!member) return;
        lines.push(`${member.name || ""},${member.jhed || ""},${member.github || ""},${member.email || ""},${member.section || ""},${timestamp}`);
    });

    fs.appendFileSync(csvPath, lines.join("\n") + "\n");
    console.log("Saved submission to CSV");
}

async function createRepo(repoName) {
    const response = await fetch(`https://api.github.com/orgs/${ORG_NAME}/repos`, {
        method: "POST",
        headers: {
            "Authorization": `token ${GITHUB_TOKEN}`,
            "Accept": "application/vnd.github+json"
        },
        body: JSON.stringify({ name: repoName, private: true })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub repo creation failed: ${errorText}`);
    }

    return response.json();
}

async function addCollaborator(repoName, username) {
    const response = await fetch(`https://api.github.com/repos/${ORG_NAME}/${repoName}/collaborators/${username}`, {
        method: "PUT",
        headers: {
            "Authorization": `token ${GITHUB_TOKEN}`,
            "Accept": "application/vnd.github+json"
        },
        body: JSON.stringify({ permission: "admin" })
    });

    if (!response.ok && response.status !== 201) {
        const errorText = await response.text();
        throw new Error(`Adding collaborator ${username} failed: ${errorText}`);
    }
}

function validateMember(member) {
    if (!member) return false;
    const requiredFields = ["name", "jhed", "github", "email", "section"];
    return requiredFields.every(f => member[f] && member[f].trim() !== "");
}

app.post("/submit", async (req, res) => {
    const { member1, member2, member3 } = req.body;

    if (!validateMember(member1) || !validateMember(member2)) {
        return res.status(400).json({ error: "Member 1 and Member 2 must be filled out." });
    }
    if (member3 && !validateMember(member3)) {
        return res.status(400).json({ error: "If Member 3 is provided, all fields must be filled." });
    }

    saveSubmissionToCSV({ member1, member2, member3 });

    const isMidterm = process.env.MIDTERM_PROJECT === "true";
    const members = [member1, member2, member3].filter(m => m && m.jhed && m.jhed.trim() !== "");
    let repoName;
    const membersToAdd = [member1.github, member2.github];
    if (member3) membersToAdd.push(member3.github);

    if (isMidterm) repoName = `${REPO_NAME_PREFIX}-midterm-${members[0].jhed}-${members[1].jhed}`;
    else repoName = `${REPO_NAME_PREFIX}-final-${members.map(m => m.jhed).join("-")}`;

    membersToAdd.push(STAFFTEAM);

    try {
        console.log(`Creating repo: ${repoName}`);
        await createRepo(repoName);
        for (const username of membersToAdd) {
            console.log(`Adding collaborator: ${username}`);
            await addCollaborator(repoName, username);
        }
        res.json({ success: true, message: `Repository "${repoName}" created and collaborators added.` });
    } catch (err) {
        console.error("Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
