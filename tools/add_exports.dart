import 'dart:io';
import 'package:path/path.dart' as path;

void main(List<String> args) {
  if (args.isEmpty) {
    print('Please specify a data layer: org, user, or admin');
    exit(1);
  }

  final dataLayers = {'user': 'gql', 'admin': 'admin-data'};

  final dataLayer = args[0];
  final targetLayer = dataLayers[dataLayer];
  if (targetLayer == null) {
    print('Invalid data layer. Use: org, user, or admin');
    exit(1);
  }

  final packageDir = Directory('lib/$targetLayer');
  if (!packageDir.existsSync()) {
    print('Package directory not found: ${packageDir.path}');
    exit(1);
  }

  final Map<String, Set<String>> fileTypes = {};

  void processFile(File file) {
    final content = file.readAsStringSync();
    final types = <String>{};

    // Input sınıflarını bul (class Input$...)
    final inputMatches = RegExp(
      r'class\s+(Input\$[\w$]+)',
      multiLine: true,
    ).allMatches(content);
    types.addAll(inputMatches.map((m) => m.group(1)!));

    // Fragment sınıflarını bul (class Fragment$... ve iç içe olanlar)
    final fragmentMatches = RegExp(
      r'class\s+(Fragment\$[\w$]+)',
      multiLine: true,
    ).allMatches(content);
    types.addAll(fragmentMatches.map((m) => m.group(1)!));

    // Enum tiplerini bul (enum Enum$...)
    final enumMatches = RegExp(
      r'enum\s+(Enum\$[\w$]+)',
      multiLine: true,
    ).allMatches(content);
    types.addAll(enumMatches.map((m) => m.group(1)!));

    if (types.isNotEmpty) {
      // Dosyanın relative path'ini al
      final relativePath = path.relative(
        file.path,
        from: path.join(packageDir.path, 'lib'),
      );
      fileTypes[relativePath] = types;
    }
  }

  void processDirectory(Directory dir) {
    for (final entity in dir.listSync()) {
      if (entity is File) {
        if (entity.path.endsWith('.graphqls.dart') ||
            entity.path.endsWith('fragments.gql.dart')) {
          processFile(entity);
        }
      } else if (entity is Directory) {
        processDirectory(entity);
      }
    }
  }

  // Tüm dosyaları recursive olarak işle
  processDirectory(packageDir);

  // Export içeriğini oluştur
  final exportContent = StringBuffer();

  exportContent.write("""
export './src/api/index.dart';
export './src/pagination.dart';

""");

  exportContent.writeln('// Generated code - do not modify by hand\n');

  // Her dosya için export statement oluştur
  for (final entry in fileTypes.entries.toList()
    ..sort((a, b) => a.key.compareTo(b.key))) {
    final relativePath = entry.key.replaceAll(Platform.pathSeparator, '/');
    final types = entry.value.toList()..sort();
    exportContent.writeln("export './$relativePath'");
    exportContent.writeln('    show ${types.join(',\n        ')};');
    exportContent.writeln();
  }

  final dartFileName = '${targetLayer}.dart'.replaceAll('-', '_');

  // Export dosyasını yaz
  final exportFile = File('${packageDir.path}/lib/${dartFileName}');
  exportFile.writeAsStringSync(exportContent.toString());
  print('Exports written to ${exportFile.path}');
}
