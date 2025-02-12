const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// GraphQL şemasını Rover CLI ile çek
async function fetchSchema(dataLayer) {
  const schemaPath = path.join(
    __dirname,
    "..",
    "lib",
    dataLayer,
    "lib",
    "src",
    "schema.graphqls"
  );

  // Dizin yoksa oluştur
  const dir = path.dirname(schemaPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  console.log("Downloading schema using Rover CLI...");
  try {
    execSync(
      `rover graph introspect http://localhost:3000/graphql --output "${schemaPath}"`,
      {
        stdio: "inherit",
      }
    );
    console.log(`Schema written to ${schemaPath}`);
  } catch (error) {
    console.error("Failed to download schema:", error);
    throw error;
  }
}

// GraphQL dosyalarını kopyala
function copyGraphQLFiles(dataLayer) {
  const gqlClientPath = path.join(__dirname, "..", "lib", "gql", "client");
  const targetBasePath = path.join(
    __dirname,
    "..",
    "lib",
    dataLayer,
    "lib",
    "src",
    "graphql"
  );

  // Hedef dizini temizle ve yeniden oluştur
  if (fs.existsSync(targetBasePath)) {
    fs.rmSync(targetBasePath, { recursive: true, force: true });
  }
  fs.mkdirSync(targetBasePath, { recursive: true });

  // Hangi dosyaları kopyalayacağımızı belirle
  const filesToCopy = {
    "user-data": ["common", "user"],
    "admin-data": ["common", "admin"],
  };

  const folders = filesToCopy[dataLayer];
  if (!folders) {
    console.error(`No GraphQL files configured for ${dataLayer}`);
    return;
  }

  // Dosyaları kopyala
  folders.forEach((folder) => {
    const sourcePath = path.join(gqlClientPath, folder);
    const targetPath = path.join(
      targetBasePath,
      folder === "common" ? "common" : ""
    );

    if (fs.existsSync(sourcePath)) {
      // Hedef dizini oluştur
      fs.mkdirSync(targetPath, { recursive: true });

      // Dosyaları kopyala
      const files = fs.readdirSync(sourcePath);
      files.forEach((file) => {
        if (file.endsWith(".gql") || file.endsWith(".graphql")) {
          const sourceFile = path.join(sourcePath, file);
          const targetFile = path.join(targetPath, file);

          // Dosya içeriğini oku ve yaz
          const content = fs.readFileSync(sourceFile, "utf8");
          fs.writeFileSync(targetFile, content, "utf8");
          console.log(`Copied ${sourceFile} to ${targetFile}`);
        }
      });
    }
  });
}

// build_runner'ı çalıştır
function runBuildRunner(dataLayer) {
  const packagePath = path.join(__dirname, "..", "lib", dataLayer);
  console.log(`Running build_runner in ${packagePath}`);

  try {
    execSync("dart run build_runner build --delete-conflicting-outputs", {
      cwd: packagePath,
      stdio: "inherit",
    });
    console.log("Build runner completed successfully");
  } catch (error) {
    console.error("Build runner failed:", error);
    process.exit(1);
  }
}

// Export'ları güncelle
function updateExports(dataLayer) {
  console.log(`Updating exports for ${dataLayer} data layer...`);
  try {
    execSync(`dart tools/add_exports.dart ${dataLayer}`, {
      stdio: "inherit",
    });
  } catch (error) {
    console.error("Failed to update exports:", error);
    throw error;
  }
}

// Ana fonksiyon
async function main() {
  const dataLayer = process.argv[2];
  if (!dataLayer) {
    console.error("Please specify a data layer: org, user, or admin");
    process.exit(1);
  }

  const dataLayers = {
    user: "user-data",
    admin: "admin-data",
  };

  const targetLayer = dataLayers[dataLayer];
  if (!targetLayer) {
    console.error("Invalid data layer. Use: org, user, or admin");
    process.exit(1);
  }

  try {
    console.log(`Fetching schema for ${dataLayer} data layer...`);
    await fetchSchema(targetLayer);

    console.log(`Copying GraphQL files for ${dataLayer} data layer...`);
    copyGraphQLFiles(targetLayer);

    console.log(`Running build_runner for ${dataLayer} data layer...`);
    runBuildRunner(targetLayer);

    console.log(`Updating exports for ${dataLayer} data layer...`);
    updateExports(dataLayer);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
