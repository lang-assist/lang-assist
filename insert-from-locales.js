// MongoDB script to insert supported_from_locales
db = db.getSiblingDB("langassist");

// First, check if there are existing records
const existingCount = db.supported_from_locales.countDocuments();
print(`Existing supported from locales: ${existingCount}`);

// Define locale data
const locales = [
  {
    tag: "en_US",
    name: "English",
    englishName: "English",
    direction: "ltr",
  },
  {
    tag: "tr_TR",
    name: "Türkçe",
    englishName: "Turkish",
    direction: "ltr",
  },
];

// Insert or update locales
for (const locale of locales) {
  // Always update the record whether it exists or not
  const result = db.supported_from_locales.updateOne(
    { tag: locale.tag },
    { $set: locale },
    { upsert: true }
  );

  if (result.matchedCount > 0) {
    print(`Updated locale: ${locale.tag} - ${locale.name}`);
  } else {
    print(`Inserted locale: ${locale.tag} - ${locale.name}`);
  }
}

// Count and list all locales after insertion
const finalCount = db.supported_from_locales.countDocuments();
print(`\nTotal supported from locales after operation: ${finalCount}`);
print("\nAll supported from locales:");
db.supported_from_locales.find().forEach((locale) => {
  print(
    `${locale.tag} - ${locale.name} - ${locale.englishName} (${locale.direction})`
  );
});
