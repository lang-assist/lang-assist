const readline = require("node:readline");
const path = require("node:path");
const dotenv = require("dotenv");

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

    console.log("NPM INSTALL", cwd);

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
  const files = glob.sync("**/*.{ts, json, graphql, gql, md}", {
    cwd: cwd,
    nodir: true,
    ignore: [
      "node_modules",
      "node_modules/**",
      "bin/server/node_modules/**",
      "bin/server/tools/node_modules/**",
      "bin/server/tools/**",
      "tools/node_modules/**",
      "dist",
      "dist/**",
      "bin/server/dist/**",
      "bin/server/dist",
      "bin/server/tools/dist/**",
      "tools/dist/**",
      "package-lock.json",
      ".tsbuildinfo",
      "**/*.tsbuildinfo",
    ],
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
  const privateEnv = dotenv.config({ path: "./tools/private.env" });
  const publicEnv = dotenv.config({ path: "./tools/public.env" });

  const r = {
    ...privateEnv.parsed,
    ...publicEnv.parsed,
    VOLUME: getVolumePath(),
    TEMP_DIR: getTempPath(),
  };

  return r;
}

start().then(() => {
  console.log("All started");
});
