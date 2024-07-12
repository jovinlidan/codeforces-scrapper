import axios from "axios";
import * as cheerio from "cheerio";
import * as dotenv from "dotenv";
import fs from "fs";
import { sleep } from "./utils";

dotenv.config();
const USERNAME = process.env.CODEFORCES_USERNAME; // replace with your Codeforces username
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // replace with your GitHub token
const GITHUB_REPO = process.env.GITHUB_REPO; // your GitHub repo name
const GITHUB_USER = process.env.GITHUB_USER; // your GitHub username

type SubmissionType = {
  problemId: string;
  problemName: string;
  submissionId: string;
};

async function getTotalMaxPage() {
  const url = `https://codeforces.com/submissions/${USERNAME}`;

  try {
    const response = await axios.get(url);
    const html = response.data;
    const $ = cheerio.load(html);

    let totalMaxPage = 1;
    $(".pagination").each((i, element) => {
      const page = $(element).find("li span").toArray().at(-1);
      totalMaxPage = parseInt($(page).text());
    });
    return totalMaxPage;
  } catch (error) {
    console.error("Error fetching or parsing the page:", error);
    return 1;
  }
}

async function fetchSubmissions(page: number) {
  const url = `https://codeforces.com/submissions/${USERNAME}/page/${page}`;
  const { data } = await axios.get(url, {});
  const $ = cheerio.load(data);

  const submissions: SubmissionType[] = [];
  $(".status-frame-datatable tr").each((i, elem) => {
    const cells = $(elem).find("td");
    const status = $(cells[5]).text().trim();
    if (status === "Accepted") {
      const problemName = $(cells[3]).text().trim().replace("-", "|");
      const submissionId = $(cells[0])
        ?.find("a")
        ?.attr("href")
        ?.split("/")
        .pop();
      const problemId = $(cells[3])?.find("a").attr("href")?.split("/").at(-3);
      if (!submissionId || !problemId) return;
      submissions.push({ problemName, submissionId, problemId });
    }
  });
  return submissions;
}

async function fetchSubmissionCode(problemId: string, submissionId: string) {
  const url = `https://codeforces.com/contest/${problemId}/submission/${submissionId}`;
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);
  const langs = $(".program-source-text").attr("class")?.split(" ") ?? [];
  const lang = langs
    .find((lang) => lang.startsWith("lang-"))
    ?.split("-")
    .pop();
  const code = $("#program-source-text").text();
  // console.log(data);
  fs.writeFileSync("./code/data.html", data);
  if (!code) {
    console.error(url);
    throw new Error(
      "Error when fetching code from Codeforces with problemId: " +
        problemId +
        " and submissionId: " +
        submissionId
    );
  }
  return { code, lang };
}

async function commitToGitHub(
  { problemId, problemName, submissionId }: SubmissionType,
  code: string,
  lang: string = "cpp"
) {
  const folderName = `${problemId}${problemName}`;
  const path = `CodeForces/${folderName}/${submissionId}.${lang}`;
  const content = Buffer.from(code).toString("base64");
  const url = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${path}`;
  try {
    await axios.put(
      url,
      {
        message: `Add solution for ${problemId}`,
        content: content,
      },
      {
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );
  } catch (e: any) {
    // console.log(e);
    if (e.response.status === 422) {
      // File already exists;
    } else {
      throw e;
    }
  }
  return;
}

async function checkRepositoryExists() {
  try {
    const response = await axios.get(
      `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}`,
      {
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );
    return response.status === 200;
  } catch (error: any) {
    if (error.response && error.response.status === 404) {
      return false;
    }
    throw error;
  }
}
async function createRepository() {
  const url = `https://api.github.com/user/repos`;
  const response = await axios.post(
    url,
    {
      name: GITHUB_REPO,
      private: false,
      // Note: Please allow "repo" scope for the token if you want to create a private repository otherwise "public_repo" scope for public repository is enough
    },
    {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3+json",
      },
    }
  );

  return response.data;
}

async function main() {
  const totalMaxPage = await getTotalMaxPage();
  try {
    const repositoryExists = await checkRepositoryExists();
    if (!repositoryExists) {
      await createRepository();
    }
    for (let page = 6; page <= totalMaxPage; page++) {
      console.log(`\nFetching page ${page}`);
      // fetch submissions
      const submissions = await fetchSubmissions(page);
      for (const submission of submissions) {
        for (let i = 0; i < 5; i++) {
          try {
            if (i > 0) await sleep(10000);
            const { lang, code } = await fetchSubmissionCode(
              submission.problemId,
              submission.submissionId
            );
            await commitToGitHub(submission, code, lang);
            console.log(
              `Committed ${submission.problemId} ${submission.problemName}`
            );
            break;
          } catch (e) {
            // retry after 10 seconds
            if (i < 4) {
              console.log(
                `Retry ${submission.problemId} ${submission.problemName} - ${
                  i + 1
                } times`
              );
            } else throw e;
          }
        }
      }
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

main()
  .then(() => console.log("Done"))
  .catch(console.error);
