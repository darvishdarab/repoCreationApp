export async function saveResultsToGithub(rows) {
const org = "jhu-ip";
const repo = process.env.RESULTS_REPO_NAME;
const token = process.env.GITHUB_TOKEN;

const prefix = process.env.REPO_NAME_PREFIX;
const midterm = process.env.MIDTERM_PROJECT === "true";

const fileName = `${prefix}-results-${midterm ? "midterm" : "final"}.csv`;

const apiBase = `https://api.github.com/repos/${org}/${repo}/contents/${fileName}`;

// 1. Check if the file already exists
let existingSha = null;
try {
    const getRes = await fetch(apiBase, {
        headers: {
            Authorization: `Bearer ${token}`,
            "User-Agent": "repoCreationApp"
        }
    });

    if (getRes.ok) {
        const json = await getRes.json();
        existingSha = json.sha;

        const existingContent = Buffer.from(json.content, "base64").toString("utf-8");
        rows = existingContent + "\n" + rows;
    }
} catch (err) {
    console.error("Error reading existing results file:", err);
}

const newContentBase64 = Buffer.from(rows).toString("base64");

// 2. Commit new file contents
const body = {
    message: "Updating results CSV",
    content: newContentBase64,
    sha: existingSha || undefined
};

const putRes = await fetch(apiBase, {
    method: "PUT",
    headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "repoCreationApp"
    },
    body: JSON.stringify(body)
});

if (!putRes.ok) {
    const errText = await putRes.text();
    throw new Error(`GitHub write failed: ${errText}`);
}

return true;

}
