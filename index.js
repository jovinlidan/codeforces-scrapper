"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const rest_1 = require("@octokit/rest");
const cheerio = __importStar(require("cheerio"));
const USERNAME = "Jovin"; // replace with your Codeforces username
const GITHUB_TOKEN = "your_github_token"; // replace with your GitHub token
const GITHUB_REPO = "codeforces-ac-solutions"; // your GitHub repo name
const octokit = new rest_1.Octokit({ auth: GITHUB_TOKEN });
function fetchSubmissions() {
    return __awaiter(this, void 0, void 0, function* () {
        const url = `https://codeforces.com/submissions/${USERNAME}`;
        const { data } = yield axios_1.default.get(url);
        const $ = cheerio.load(data);
        const submissions = [];
        $(".status-frame-datatable tr").each((i, elem) => {
            var _a, _b, _c;
            const cells = $(elem).find("td");
            const status = $(cells[5]).text().trim();
            if (status === "Accepted") {
                const problemId = $(cells[3]).text().trim();
                const submissionId = (_c = (_b = (_a = $(cells[0])) === null || _a === void 0 ? void 0 : _a.find("a")) === null || _b === void 0 ? void 0 : _b.attr("href")) === null || _c === void 0 ? void 0 : _c.split("/").pop();
                if (!submissionId)
                    return;
                submissions.push({ problemId, submissionId });
            }
        });
        return submissions;
    });
}
function fetchSubmissionCode(submissionId, problemId) {
    return __awaiter(this, void 0, void 0, function* () {
        const url = `https://codeforces.com/contest/${problemId}/submission/${submissionId}`;
        const { data } = yield axios_1.default.get(url);
        const $ = cheerio.load(data);
        return $("#program-source-text").text();
    });
}
function commitToGitHub(problemId, code) {
    return __awaiter(this, void 0, void 0, function* () {
        const path = `${problemId}.cpp`; // assuming C++ for this example, adjust file extension as needed
        const content = Buffer.from(code).toString("base64");
        yield octokit.repos.createOrUpdateFileContents({
            owner: "your_github_username", // replace with your GitHub username
            repo: GITHUB_REPO,
            path,
            message: `Add solution for ${problemId}`,
            content,
        });
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const submissions = yield fetchSubmissions();
            for (const submission of submissions) {
                console.log(`Committed ${submission.problemId}`);
                // const code = await fetchSubmissionCode(submission.problemId, submission.submissionId);
                // await commitToGitHub(submission.problemId, code);
            }
        }
        catch (error) {
            console.error("Error:", error);
        }
    });
}
main();
