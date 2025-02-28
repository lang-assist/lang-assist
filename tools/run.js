const readline = require("node:readline");
const path = require("node:path");

const childProcess = require("child_process");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("Executor starts");

rl.on("line", (i) => {
  if (i === "q") {
    process.exit(0);
  } else {
    const servers = i.split(" ");

    const withDep = servers.some((e) => {
      return e === "-d" || e === "--d";
    });

    const forceBuild = servers.some((e) => {
      return e === "-f" || e === "--f";
    });

    for (let i = 0; i < servers.length; i++) {
      const s = servers[i].trim();

      if (s.startsWith("-")) {
        continue;
      }

      if (paths[s] === undefined) {
        console.error(`Unknown server ${s}`);
        return;
      }

      restart(s, withDep, forceBuild).then(() => {});
    }
  }
});

const paths = {
  s: "bin/server",
};

const dependencies = {
  s: [],
};

/**
 * @type {{
 *     [key: string]: childProcess.ChildProcess | null
 * }}
 * */
const instances = {};

async function npmInstall(server) {
  return await new Promise(async (resolve, reject) => {
    const cwd = path.join(__dirname, "..", paths[server]);

    console.log(`[${server}] - Installing...`, cwd);

    const npmInstall = childProcess.spawn("npm", ["install"], {
      cwd: cwd,
      shell: true,
    });

    npmInstall.stdout.on("data", (data) => {
      console.log(`[${server}] - i: ${data}`);
    });

    npmInstall.stderr.on("data", (data) => {
      console.error(`[${server}] - i: ${data}`);
    });

    npmInstall.on("close", (code) => {
      console.log(`[${server}] - i exited with code ${code}`);
      resolve();
    });

    npmInstall.on("error", (err) => {
      console.log(`[${server}] - i error ${err}`);
      reject(err);
    });

    npmInstall.on("exit", (code) => {
      console.log(`[${server}] - i exit ${code}`);
      resolve();
    });
  });
}

async function tscBuild(server) {
  return await new Promise(async (resolve, reject) => {
    const cwd = path.join(__dirname, "..", paths[server]);

    console.log(`[${server}] - Building...`, cwd);

    const tscB = childProcess.spawn("tsc", ["-p", "tsconfig.json"], {
      cwd: cwd,
      shell: true,
    });

    tscB.stdout.on("data", (data) => {
      console.log(`[${server}] - b: ${data}`);
    });

    tscB.stderr.on("data", (data) => {
      console.error(`[${server}] - b: ${data}`);
    });

    tscB.on("close", (code) => {
      console.log(`[${server}] - b exited with code ${code}`);
      resolve();
    });

    tscB.on("error", (err) => {
      console.log(`[${server}] - b error ${err}`);
      reject(err);
    });

    tscB.on("exit", (code) => {
      console.log(`[${server}] - b exit ${code}`);
      resolve();
    });
  });
}

const fs = require("fs");

const hashesPath = path.join(__dirname, "hashes.json");

const hashesExist = fs.existsSync(hashesPath);

const hashes = hashesExist ? require(hashesPath) : {};

console.log("HASHES", hashes, hashesExist);

const md5 = require("md5");
const glob = require("glob");

function sha1Sum(server) {
  const cwd = path.join(__dirname, "..", paths[server]);

  // Get all files in the directory, excluding certain paths
  const files = glob.sync("**", {
    cwd: cwd,
    nodir: true,
    ignore: ["node_modules/**", "dist/**", "package-lock.json"],
  });

  // Sort the files to ensure consistent ordering
  files.sort();

  // Create a hash of each file's contents
  const hashes = files.map((file) => {
    const fileContent = fs.readFileSync(path.join(cwd, file));
    return md5(fileContent);
  });

  // Concatenate all the hashes and hash the result to get a single hash
  const finalHash = md5(hashes.join(""));

  return finalHash;
}

function needTscBuild(server) {
  const hash = sha1Sum(server);

  let need = hash !== hashes[server];

  console.log(`[${server}] - Hash: ${hash} - ${hashes[server]} - ${need}`);

  hashes[server] = hash;

  need =
    need || !fs.existsSync(path.join(__dirname, "..", paths[server], "dist"));
  need =
    need ||
    !fs.existsSync(path.join(__dirname, "..", paths[server], "node_modules"));
  need =
    need ||
    !fs.existsSync(
      path.join(__dirname, "..", paths[server], "package-lock.json")
    );

  return need;
}

function setHash(server) {
  const hash = sha1Sum(server);
  hashes[server] = hash;
  fs.writeFileSync(hashesPath, JSON.stringify(hashes, null, 4));
}

/**
 *
 * Returns true if build is needed
 *
 * @param {string} server
 * @param {boolean} withDep
 * @param {boolean} forceBuild
 * */
async function restart(server, withDep, forceBuild = false) {
  return await new Promise(async (resolve, reject) => {
    let buildNeeded = false;

    if (forceBuild) {
      buildNeeded = true;
    } else {
      buildNeeded = needTscBuild(server);
    }

    console.log(`[${server}] - Build needed: ${buildNeeded}`);

    if (withDep) {
      const deps = dependencies[server];
      for (let i = 0; i < deps.length; i++) {
        const dep = deps[i];
        const need = await restart(dep, true, forceBuild);
        buildNeeded = buildNeeded || need;
      }
    }

    if (withDep || buildNeeded) {
      await npmInstall(server);
    }

    const isBin = paths[server].startsWith("bin");

    if (isBin) {
      if (buildNeeded) {
        await tscBuild(server);
      }
      setHash(server);
    } else {
      if (buildNeeded) {
        await tscBuild(server);
      }
      setHash(server);
      resolve(buildNeeded);
      return;
    }

    const cwd = path.join(__dirname, "..", paths[server]);

    console.log(`[${server}] - Restarting...`, cwd, typeof instances[server]);

    if (instances[server]) {
      // emit ctrl+c
      // write line "kill"
      await instances[server]?.stdin?.write("kill\n");
      await instances[server]?.kill("SIGTERM");

      instances[server] = undefined;

      console.log(`[${server}] - Killed`);
    }

    console.log(`[${server}] - Starting...`, cwd);

    const instance = childProcess.spawn(
      /^win/.test(process.platform) ? "npm.cmd" : "npm",
      ["start"],
      {
        cwd: cwd,
        shell: true,
        env: {
          ...process.env,
          ...getEnv(),
        },
      }
    );

    instance.stdout.on("data", (data) => {
      console.log(`[${server}]: ${data}`);
    });

    instance.stderr.on("data", (data) => {
      console.error(`[${server}]: ${data}`);
    });

    instance.on("close", (code) => {
      console.log(`[${server}] exited with code ${code}`);
      resolve();
    });

    instance.on("error", (err, stack) => {
      console.log(`[${server}] error ${err}`);
      reject(err, stack);
    });

    instance.on("exit", (code) => {
      console.log(`[${server}] exit ${code}`);
      resolve();
    });

    instances[server] = instance;
  });
}

async function start() {
  try {
    restart("s", false).then(() => {
      console.log("Server started");
    });
  } catch (e) {
    console.error(e);
  }
}

start().then(() => {
  console.log("All started");
});

function getVolumePath() {
  const p = "D:\\langassist-volume";

  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
  }

  return p;
}

function getTempPath() {
  const p = "D:\\langassist-temp";

  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
  }

  return p;
}

function getEnv() {
  return {
    SERVER_PORT: 3000,
    SERVER_URL: "http://localhost:3000",
    ENV: "local",
    VOLUME: getVolumePath(),

    MONGO_URL: "mongodb://localhost:27017/langassist",
    MONGO_VECTOR_URL: "mongodb://localhost:27017/langassist-vector",
    REDIS_HOST: "localhost",
    REDIS_PORT: 6379,
    REDIS_PASSWORD: "",
    HOST_NAME: "localhost",
    UI_URL: "http://localhost:8080",
    ENCRYPTION_KEY:
      "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",

    STORAGE_LOCATION: "local",
    COOKIE_KEY:
      "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",

    TEMP_DIR: getTempPath(),

    ELASTIC_URL: "http://localhost:9200",

    OPENAI_API_KEY:
      "sk-svcacct-5SHkcwFxxS8n1vYWURof2OtduW6gfR-qj7bR4IHChgRdj-ekM7JMgRrjmxH1xon6gT3BlbkFJQhrt2bL2clQCy4rytTEpiKosGoQCB4wye5lpofRhOznQJYMjz3mdLYIeg61cUzTAA",

    AZURE_SPEECH_KEY: "b3537456-33e2-4fe0-b693-9442ccd69a58",
    AZURE_SPEECH_REGION: "eastus",
    AZURE_SPEECH_TOKEN:
      "BClEQtu2kLgVOe81cMZuUL4gMNORySsqKUJa6n2pLDXO2hFKMLk6JQQJ99BBACYeBjFXJ3w3AAAAACOGza4S",

    DEEPSEEK_API_KEY: "sk-dcf6996be05a46fab1737a0e7c45bcd3",
    ANTHROPIC_API_KEY:
      "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",
    FAL_API_KEY:
      "657e6995-c511-4673-8c24-04ced17a1d0f:81edb7e07d98b1ed40aada1c35338f5e",
    AZURE_AI_KEY:
      "BClEQtu2kLgVOe81cMZuUL4gMNORySsqKUJa6n2pLDXO2hFKMLk6JQQJ99BBACYeBjFXJ3w3AAAAACOGza4S",
  };
}
