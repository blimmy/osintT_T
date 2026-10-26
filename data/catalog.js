(function () {
  'use strict';

  // Every task maps directly to the three sections rendered by the command reference.
  const R = (id, title, goal, keywords, commands) => ({ id, title, goal, keywords, commands });
  const C = (label, command) => ({ label, command });
  const T = (id, name, purpose, categories, formats, license, homepage, install, errors, alternatives, recipes) => ({
    id, name, purpose, categories, formats, license, homepage, install, errors, alternatives, recipes
  });

  const tools = [
    T('exiftool', 'ExifTool', 'อ่าน metadata แบบ read-only เพื่อหาเวลา พิกัด กล้อง ผู้สร้าง และประวัติซอฟต์แวร์',
      ['Image OSINT', 'Geolocation', 'Documents', 'Video / Audio', 'Timeline'],
      ['JPEG', 'PNG', 'TIFF', 'HEIC', 'PDF', 'Office', 'MP4', 'MOV', 'audio'],
      'Artistic-1.0-Perl OR GPL-1.0-or-later', 'https://exiftool.org/',
      { mac: 'brew install exiftool', linux: 'sudo apt install libimage-exiftool-perl' },
      ['File not found → ตรวจ path และ quoting', 'ไม่มี output ที่ต้องการ → tag อาจไม่มีหรือถูก strip', 'ค่าซ้ำหลาย group → ใช้ -a -G1 -s เพื่อเห็นแหล่งของ tag'],
      ['file', 'ffprobe', 'pdfinfo', 'tesseract'], [
        R('all', 'Inspect all metadata', 'ตรวจว่ามี metadata อะไรอยู่บ้าง',
          ['metadata', 'EXIF', 'camera information', 'original image', 'image properties'],
          ['exiftool -a -G1 -s {{file}}']),
        R('timestamp', 'Find image timestamps', 'หาเวลาถ่ายภาพและแยกออกจากเวลาของไฟล์',
          ['When was the photo taken?', 'date taken', 'capture timestamp', 'original date', 'file creation date', 'timezone'],
          ['exiftool -a -G1 -s -time:all {{file}}', 'exiftool -DateTimeOriginal -CreateDate -ModifyDate -OffsetTimeOriginal -GPSDateTime {{file}}']),
        R('gps', 'Extract Latitude and Longitude', 'ดึงพิกัดและตรวจรูปแบบ/ช่วงค่า',
          ['GPS', 'latitude', 'longitude', 'coordinates', 'Where was this taken?', 'geolocation'],
          ['exiftool -GPSLatitude -GPSLongitude -GPSPosition {{file}}', 'exiftool -n -GPSLatitude -GPSLongitude {{file}}', 'exiftool -a -G1 -s -gps:all {{file}}']),
        R('camera', 'Find camera make and model', 'ดูผู้ผลิต รุ่นกล้อง เลนส์ และ serial ที่ไฟล์บันทึกไว้',
          ['camera make', 'camera model', 'lens model', 'serial number', 'Which camera took this?'],
          ['exiftool -Make -Model -LensMake -LensModel -SerialNumber {{file}}']),
        R('software', 'Inspect editing software', 'หา tag ของโปรแกรมที่สร้าง แก้ไข หรือประมวลผลไฟล์',
          ['editing software', 'CreatorTool', 'ProcessingSoftware', 'Was this edited?', 'software history'],
          ['exiftool -a -G1 -s -Software -CreatorTool -ProcessingSoftware -HistorySoftwareAgent {{file}}']),
        R('document', 'Inspect document metadata', 'หาผู้สร้าง บริษัท โปรแกรม และผู้แก้ไขล่าสุดจาก metadata เอกสาร',
          ['PDF metadata', 'document author', 'company', 'LastModifiedBy', 'Producer'],
          ['exiftool -a -G1 -s -Author -Creator -Company -LastModifiedBy -Producer -CreatorTool {{file}}']),
        R('thumbnail', 'Extract embedded thumbnail', 'แยก thumbnail ที่ฝังอยู่เพื่อตรวจภาพเวอร์ชันก่อนแก้ไขหรือ crop',
          ['embedded thumbnail', 'preview image', 'original crop', 'ThumbnailImage'],
          ['exiftool -b -ThumbnailImage {{file}} > thumbnail.jpg', 'file thumbnail.jpg']),
        R('timestamp-conflicts', 'Compare conflicting timestamps', 'เปรียบเทียบเวลาในแต่ละ metadata group พร้อม timezone เพื่อหาค่าที่ขัดกัน',
          ['timestamp differences', 'conflicting dates', 'timezone offset', 'FileModifyDate', 'GPSDateTime'],
          ['exiftool -a -G0:1 -s -DateTimeOriginal -CreateDate -ModifyDate -FileModifyDate -OffsetTimeOriginal -GPSDateTime {{file}}']),
        R('xmp-iptc', 'Inspect XMP and IPTC tags', 'ค้น creator, rights, caption, keyword และ provenance ที่อยู่ใน XMP/IPTC',
          ['XMP', 'IPTC', 'copyright', 'caption', 'keywords', 'provenance'],
          ['exiftool -a -G1 -s -xmp:all -iptc:all {{file}}']),
        R('batch', 'Read metadata from multiple files', 'สร้างตาราง metadata จากโฟลเดอร์รูปโดยไม่แก้ไฟล์ต้นฉบับ',
          ['batch metadata', 'multiple images', 'CSV report', 'compare photos'],
          ['exiftool -r -a -G1 -s -csv -ext jpg -ext jpeg -ext png images/ > metadata.csv']),
        R('no-metadata', 'No useful metadata', 'ยืนยันว่าอ่านไฟล์สำเร็จแล้วเปลี่ยนไปใช้ clue class ใหม่',
          ['no EXIF', 'metadata stripped', 'screenshot', 'empty output'],
          ['file {{file}}', 'exiftool -a -G1 -s {{file}}'])
      ]),

    T('openssl', 'OpenSSL', 'ตรวจ public TLS certificate ของ host ที่ผู้ใช้ระบุ', ['Website / Domain'], ['X.509 certificates'],
      'Apache-2.0', 'https://docs.openssl.org/',
      { mac: 'brew install openssl', linux: 'sudo apt install openssl' },
      ['Wrong certificate → ต้องใส่ -servername สำหรับ SNI', 'Certificate identity ไม่พิสูจน์ legal operator'], ['curl', 'dig'], [
        R('certificate', 'Inspect certificate subject and dates', 'ดู subject, issuer, validity ของ public TLS endpoint', ['TLS certificate', 'issuer', 'certificate dates'], ['openssl s_client -connect example.org:443 -servername example.org </dev/null 2>/dev/null | openssl x509 -noout -subject -issuer -dates']),
        R('san', 'Inspect Subject Alternative Names', 'ดู hostnames ที่ certificate ครอบคลุม', ['certificate SAN', 'subdomain', 'hostname'], ['openssl s_client -connect example.org:443 -servername example.org </dev/null 2>/dev/null | openssl x509 -noout -ext subjectAltName'])
      ]),

    T('ripgrep', 'ripgrep (rg)', 'ค้นข้อความใน local files/corpus อย่างรวดเร็ว', ['Search', 'Documents', 'Web source', 'Validation'], ['Text', 'HTML', 'XML', 'JSON', 'source trees'],
      'Unlicense', 'https://github.com/BurntSushi/ripgrep',
      { mac: 'brew install ripgrep', linux: 'sudo apt install ripgrep' },
      ['Binary files skipped by default', 'Regex too broad → use fixed string -F', 'No output means no local match, not global absence'], ['strings', 'jq'], [
        R('local-search', 'Search a local corpus', 'หา exact clue ในไฟล์ที่ดาวน์โหลดอย่างถูกต้อง', ['search files', 'exact phrase', 'local corpus'], ['rg -n -i "exact phrase" downloaded-public-corpus/']),
        R('html', 'Find metadata in saved HTML', 'หา canonical, author, datePublished และ og:url', ['HTML metadata', 'canonical', 'author', 'datePublished'], ['rg -n -i "canonical|author|datePublished|og:url" page.html']),
        R('urls', 'Find URLs in extracted text', 'กรอง URL clues จาก text/documents', ['find URL', 'document links', 'encoded URL'], ['rg -n -o "https?://[^[:space:]]+" output.txt'])
      ]),

    T('python', 'Python standard library', 'ตรวจ/ถอด encoding, parse URL/JSON, แปลงเวลา และ decompress แบบ local', ['Text / Encoding', 'Web', 'Timeline', 'Safety'], ['Text', 'JSON', 'binary bytes'],
      'PSF License', 'https://docs.python.org/3/library/',
      { mac: 'brew install python', linux: 'sudo apt install python3' },
      ['Decoder acceptance ไม่พิสูจน์ hypothesis', 'UnicodeDecodeError → output อาจเป็น binary', 'Limit input/output before decompress'], ['xxd', 'file', 'jq'], [
        R('base64', 'Validate and decode Base64', 'ทดสอบ Base64 แบบ strict แล้ว inspect output', ['decode base64', 'SGVsbG8=', 'base64 validation'], ['python3 -c \'import base64;d=base64.b64decode("SGVsbG8=",validate=True);print(d)\'']),
        R('hex', 'Decode hexadecimal text', 'แปลง even-length hex เป็น bytes', ['decode hex', '48656c6c6f', 'hexadecimal'], ['python3 -c \'print(bytes.fromhex("48656c6c6f"))\'']),
        R('url', 'Parse and decode a URL', 'แยก hostname/path/query โดยไม่ fetch', ['parse URL', 'percent encoding', 'encoded URL', 'hostname'], ['python3 -c \'from urllib.parse import urlsplit,unquote;u=urlsplit("https://example.org/a%20b?q=1");print(u.hostname,unquote(u.path),u.query)\'']),
        R('timestamp', 'Interpret Unix timestamps', 'แยก seconds/milliseconds และแสดง UTC', ['Unix timestamp', 'epoch', '1700000000', 'milliseconds'], ['python3 -c \'import datetime;print(datetime.datetime.fromtimestamp(1700000000,datetime.timezone.utc))\'']),
        R('json', 'Parse JSON safely', 'ตรวจ JSON/escaped JSON โดยไม่ eval', ['JSON', 'escaped JSON', 'JWT payload'], ['python3 -m json.tool {{file}}']),
        R('unicode', 'Inspect invisible Unicode', 'แสดง repr/code points/normalization ของข้อความ', ['zero-width space', 'invisible Unicode', 'normalization'], ['python3 -c \'import unicodedata as u;s=open("input.txt",encoding="utf-8").read();print(repr(s));print([(hex(ord(c)),u.name(c,"?")) for c in s])\'']),
        R('gzip', 'Decompress gzip with a size bound', 'ถอด compressed clue โดยจำกัด output และไม่ execute', ['gzip base64', '1f8b magic', 'nested encoding'], ['python3 -c \'import gzip;f=gzip.open("decoded.bin","rb");d=f.read(10000001);f.close();assert len(d)<=10000000,"output exceeds 10 MB";open("out.bin","wb").write(d)\'', 'file out.bin'])
      ]),

    T('qgis', 'QGIS', 'ตรวจพิกัดและเปรียบเทียบชั้นข้อมูลแผนที่แบบ desktop open-source', ['Geolocation', 'Maps'], ['GeoJSON', 'KML', 'GPX', 'Shapefile', 'raster/vector layers'],
      'GPL-2.0-or-later', 'https://qgis.org/',
      { mac: 'brew install --cask qgis', linux: 'sudo apt install qgis' },
      ['CRS mismatch → ตรวจ EPSG/source CRS', 'Online basemap transmits map tile/extent requests'], ['openstreetmap', 'python'], [
        R('coordinates', 'Plot coordinates locally', 'เพิ่ม point และตรวจ coordinate order/CRS', ['plot GPS', 'latitude longitude', 'coordinate validation'], ['python3 -c \'lat,lon=13.7563,100.5018;assert -90<=lat<=90 and -180<=lon<=180;print(lon,lat)\'']),
        R('layers', 'Compare map or satellite clues', 'วาง control points/roads/coastline หลายจุดเพื่อทดสอบ candidate', ['map screenshot', 'satellite match', 'control points'], ['Open QGIS → add local/public layers → set CRS → compare at least 3 control points'])
      ]),

    T('openstreetmap', 'OpenStreetMap', 'ดู public map data โดยไม่อัปโหลด challenge artifact', ['Geolocation', 'Public research'], ['Coordinates', 'place-name text queries'],
      'Open data under ODbL; website software open source', 'https://www.openstreetmap.org/',
      { mac: 'No install; browser or QGIS data layer', linux: 'No install; browser or QGIS data layer' },
      ['Opening map transmits coordinate/text query and viewport', 'Map completeness varies', 'Do not auto-open extracted coordinates'], ['qgis'], [
        R('coordinate', 'Open a coordinate only after consent', 'ดู nearby roads/buildings จากพิกัดที่ผู้ใช้ยืนยัน', ['coordinate map', 'nearby landmark', 'OSM'], ['Open manually: https://www.openstreetmap.org/?mlat=13.7563&mlon=100.5018#map=17/13.7563/100.5018']),
        R('place', 'Search a verified public place name', 'หา map object จากชื่อที่ OCR/official source ยืนยันแล้ว', ['place name', 'station', 'shop', 'nearby building'], ['Type the verified public place name into OpenStreetMap search manually'])
      ]),

    T('diff', 'diff', 'เปรียบเทียบ text สองเวอร์ชันเพื่อหา additions/removals', ['Documents', 'Archives', 'Timeline'], ['Text files'],
      'GPL-3.0-or-later (GNU diffutils; system variant may differ)', 'https://www.gnu.org/software/diffutils/manual/',
      { mac: 'Built into macOS', linux: 'sudo apt install diffutils' },
      ['Layout/OCR changes create noise', 'Exit code 1 means differences found, not tool failure'], ['pdftotext', 'hash'], [
        R('text', 'Compare two text versions', 'หา exact line changes', ['what changed', 'removed text', 'before after'], ['diff -u old.txt new.txt']),
        R('html', 'Compare saved public HTML', 'ดู page content change โดยไม่รัน script', ['website changed', 'removed page', 'archive compare'], ['diff -u old.html new.html'])
      ]),

    T('hash', 'SHA-256 utilities', 'ยืนยันว่าไฟล์ต้นฉบับไม่เปลี่ยนและเปรียบเทียบ file identity', ['Evidence handling', 'Verification'], ['Any local file'],
      'System tools: Perl/GNU coreutils licenses vary', 'https://www.gnu.org/software/coreutils/manual/html_node/sha2-utilities.html',
      { mac: 'Built in: shasum', linux: 'Built in/coreutils: sha256sum' },
      ['Hash match proves byte identity only', 'Different metadata/recompression changes hash'], ['file', 'diff'], [
        R('sha256', 'Hash an evidence file', 'บันทึก fingerprint ก่อนทำ derived copies', ['hash evidence', 'integrity', 'SHA-256'], [C('macOS', 'shasum -a 256 {{file}}'), C('Kali / Ubuntu', 'sha256sum {{file}}')]),
        R('compare', 'Compare file identity', 'ตรวจว่าสองไฟล์ bytes เหมือนกันหรือไม่', ['same file', 'duplicate', 'version comparison'], [C('macOS', 'shasum -a 256 old.pdf new.pdf'), C('Kali / Ubuntu', 'sha256sum old.pdf new.pdf')])
      ]),

    T('shell', 'POSIX shell utilities', 'ใช้ printf, head, sed และ mkdir สำหรับ pipeline ที่ไม่ execute evidence', ['Command line', 'Safety'], ['Text streams', 'directories'],
      'Multiple open-source/system licenses', 'https://pubs.opengroup.org/onlinepubs/9799919799/utilities/contents.html',
      { mac: 'Built into macOS', linux: 'Built into Kali/Ubuntu' },
      ['Never use eval on evidence text', 'Quote paths', 'Redirect decoded bytes to a new file only'], ['python', 'ripgrep'], [
        R('quote', 'Use safe path quoting', 'ให้เว็บไซต์สร้าง single-quoted POSIX path ที่ไม่ถูก shell expand', ['spaces in filename', 'shell special characters', 'safe command'], ['printf "%s\\n" {{file}}']),
        R('preview', 'Limit command output', 'ใช้ head เพื่อไม่ให้ terminal ถูก output ปริมาณมาก', ['limit output', 'preview strings', 'safe triage'], ['strings -a -n 6 {{file}} | head -100'])
      ]),

    T('curl', 'curl', 'ส่งคำขอ read-only ไป public URL ที่ผู้ใช้เลือกเองเพื่อดู header, redirects และ content', ['Website / Domain', 'Public research'], ['HTTP(S) responses', 'HTML', 'XML', 'JSON'],
      'curl License', 'https://curl.se/docs/manpage.html',
      { mac: 'Built into macOS (or brew install curl)', linux: 'sudo apt install curl' },
      ['HTTP 403/429 → ห้าม bypass; ใช้ public alternative', 'Redirect loop → จำกัดและตรวจ Location', 'Network command transmits hostname/IP'], ['openssl', 'ripgrep', 'jq'], [
        R('headers', 'Inspect public HTTP headers', 'ดู status, server hints, dates และ content type โดยไม่โหลด body', ['HTTP headers', 'server timestamp', 'content type'], ['curl -fsSIL --max-time 15 https://example.org/']),
        R('redirects', 'Trace redirects safely', 'ดู Location chain ของ public URL', ['short URL', 'redirect', 'canonical destination'], ['curl -sSIL --max-time 15 --max-redirs 5 https://example.org/']),
        R('html', 'Retrieve public HTML read-only', 'บันทึกหน้า public เพื่อค้น title/canonical/about', ['HTML source', 'canonical', 'organization page'], ['curl -fsSL --max-time 20 https://example.org/ -o page.html', 'rg -n -i "canonical|application/ld\\+json|og:|about|legal" page.html']),
        R('robots', 'Inspect robots.txt', 'อ่าน public crawl directives และ Sitemap lines', ['robots.txt', 'Disallow', 'Sitemap'], ['curl -fsSL --max-time 15 https://example.org/robots.txt']),
        R('sitemap', 'Inspect a public sitemap', 'ดู listed URLs/lastmod ที่เกี่ยวข้องกับโจทย์', ['sitemap.xml', 'public URLs', 'lastmod'], ['curl -fsSL --max-time 15 https://example.org/sitemap.xml -o sitemap.xml', 'rg -n "<loc>|<lastmod>" sitemap.xml | head -80'])
      ]),

    T('dig', 'dig (BIND)', 'สอบถาม DNS records ที่ระบุแบบ passive และบันทึก TTL/เวลา', ['Website / Domain', 'Organization'], ['DNS A/AAAA/MX/NS/TXT/CNAME/PTR'],
      'MPL-2.0', 'https://bind9.readthedocs.io/en/stable/manpages.html#dig-dns-lookup-utility',
      { mac: 'brew install bind', linux: 'sudo apt install dnsutils' },
      ['NXDOMAIN ต่างจาก timeout/SERVFAIL', 'DNS relation เป็น technical relation ไม่พิสูจน์ legal ownership'], ['host', 'rdap', 'curl'], [
        R('records', 'Inspect common DNS records', 'ดู address, mail, nameserver และ claims', ['DNS records', 'A AAAA MX NS TXT', 'domain infrastructure'], ['for t in A AAAA MX NS TXT; do dig +short example.org "$t"; done']),
        R('trace', 'Trace DNS delegation', 'แยก resolver failure จาก authoritative path', ['dig trace', 'SERVFAIL', 'delegation'], ['dig +trace example.org']),
        R('reverse', 'Reverse lookup a public IP', 'ดู PTR hint ของ IP ที่โจทย์ให้มา', ['PTR', 'reverse DNS', 'IP clue'], ['dig -x 192.0.2.10 +short']),
        R('txt', 'Inspect TXT claims', 'ดู SPF/site verification/public text record', ['TXT record', 'SPF', 'domain verification'], ['dig +noall +answer example.org TXT'])
      ]),

    T('host', 'host', 'DNS lookup แบบสั้นสำหรับยืนยันผลเบื้องต้น', ['Website / Domain'], ['DNS names and addresses'],
      'MPL-2.0 (BIND)', 'https://bind9.readthedocs.io/en/stable/manpages.html#host-dns-lookup-utility',
      { mac: 'brew install bind', linux: 'sudo apt install dnsutils' },
      ['Output concise but less controllable than dig', 'No result may be NXDOMAIN or lookup failure'], ['dig'], [
        R('lookup', 'Quick hostname lookup', 'ตรวจ A/AAAA/MX แบบเร็ว', ['host lookup', 'domain IP'], ['host example.org']),
        R('reverse', 'Quick reverse lookup', 'ตรวจ PTR จาก public IP', ['reverse lookup', 'PTR'], ['host 192.0.2.10'])
      ]),

    T('whois', 'whois', 'ดู public registration text เมื่อ registry ยังให้ WHOIS', ['Website / Domain', 'Timeline'], ['Domain names', 'IP allocations'],
      'GPL-2.0-or-later (Homebrew whois)', 'https://github.com/rfc1036/whois',
      { mac: 'brew install whois', linux: 'sudo apt install whois' },
      ['Privacy/redaction เป็นปกติ', 'WHOIS formats vary; prefer RDAP for structured data', 'Creation date is domain registration, not website publication'], ['rdap', 'dig'], [
        R('domain', 'Inspect public WHOIS data', 'หา registrar/status/dates ที่เปิดเผยสาธารณะ', ['who owns domain', 'registrar', 'registration'], ['whois example.org | head -100']),
        R('dates', 'Interpret WHOIS dates', 'แยก registration/update/expiry จาก content history', ['domain created date', 'updated date', 'website age'], ['whois example.org | rg -i "creat|updated|expir|registered"'])
      ]),

    T('rdap', 'RDAP via curl', 'อ่าน registration data แบบ JSON จาก public RDAP service', ['Website / Domain', 'Timeline', 'Organization'], ['RDAP JSON'],
      'Protocol/open standard; curl client uses curl License', 'https://www.icann.org/rdap/',
      { mac: 'Uses curl + jq: brew install jq', linux: 'sudo apt install curl jq' },
      ['Redacted entities are expected', 'Bootstrap/service may redirect', 'Events are registration events, not page publication'], ['whois', 'jq', 'curl'], [
        R('domain', 'Retrieve domain RDAP', 'ดู status, nameservers, entities และ notices', ['RDAP', 'domain registration', 'registrar'], ['curl -fsSL https://rdap.org/domain/example.org | jq "{events,nameservers,entities,notices}"']),
        R('events', 'Inspect RDAP events', 'แยก registration/last changed/expiration dates', ['domain date', 'registration event', 'RDAP events'], ['curl -fsSL https://rdap.org/domain/example.org | jq ".events"']),
        R('entities', 'Interpret RDAP entity roles', 'แยก registrar, registrant, technical contact และ redaction', ['domain owner', 'organization role', 'registrar'], ['curl -fsSL https://rdap.org/domain/example.org | jq ".entities[] | {roles,vcardArray}"'])
      ]),

    T('pdfinfo', 'pdfinfo', 'อ่าน metadata, page count, encryption และขนาดหน้าของ PDF', ['Document OSINT', 'Timeline'], ['PDF'],
      'GPL-2.0-only OR GPL-3.0-only (Poppler)', 'https://poppler.freedesktop.org/',
      { mac: 'brew install poppler', linux: 'sudo apt install poppler-utils' },
      ['Encrypted: yes → text extraction อาจถูกจำกัด', 'Syntax Error → PDF อาจเสียหรือไม่ใช่ PDF'], ['exiftool', 'pdftotext'], [
        R('metadata', 'Inspect PDF metadata', 'หา title, author, creator, dates และจำนวนหน้า', ['PDF author', 'PDF date', 'document metadata'], ['pdfinfo {{file}}']),
        R('encryption', 'Check PDF restrictions', 'แยก scanned/locked/damaged ก่อน extraction', ['PDF encrypted', 'copy restricted', 'cannot extract'], ['pdfinfo {{file}} | rg "^(Encrypted|Pages|PDF version)"'])
      ]),

    T('pdftotext', 'pdftotext', 'ดึง text layer จาก PDF ในเครื่องโดยรักษา layout เมื่อจำเป็น', ['Document OSINT', 'Search'], ['PDF'],
      'GPL-2.0-only OR GPL-3.0-only (Poppler)', 'https://poppler.freedesktop.org/',
      { mac: 'brew install poppler', linux: 'sudo apt install poppler-utils' },
      ['Output ว่าง → PDF อาจเป็น scan', 'ตัวอักษรเพี้ยน → embedded font mapping/OCR needed'], ['pdfinfo', 'pdftoppm', 'ripgrep'], [
        R('extract', 'Extract searchable PDF text', 'ดึงเนื้อหาไปไฟล์ local', ['extract PDF text', 'read PDF', 'PDF URL'], ['pdftotext -layout {{file}} output.txt']),
        R('plain', 'Extract without layout', 'ลด spacing artifacts เมื่อต้องการ text ต่อเนื่อง', ['PDF text order', 'garbled layout', 'paragraph text'], ['pdftotext {{file}} output.txt']),
        R('search', 'Search extracted document clues', 'หา URL, author, address, date หรือ organization ใน text', ['read PDF author', 'PDF keyword', 'embedded URL'], ['rg -n -i "https?://|author|date|address|organization" output.txt'])
      ]),

    T('pdftoppm', 'pdftoppm', 'render หน้า PDF เป็นภาพสำหรับ local OCR', ['Document OSINT', 'OCR'], ['PDF to PNG/JPEG'],
      'GPL-2.0-only OR GPL-3.0-only (Poppler)', 'https://poppler.freedesktop.org/',
      { mac: 'brew install poppler', linux: 'sudo apt install poppler-utils' },
      ['Output files many → จำกัดหน้า -f/-l', 'Memory high → ลด DPI'], ['tesseract', 'pdftotext'], [
        R('render', 'Render selected PDF pages', 'แปลงหน้าเป็น PNG โดยไม่แก้ PDF', ['render PDF page', 'scanned PDF', 'embedded image'], ['pdftoppm -png -r 200 -f 1 -l 3 {{file}} page']),
        R('ocr', 'OCR a rendered PDF page', 'อ่านข้อความจาก scanned page', ['scanned PDF OCR', 'empty pdftotext', 'page image'], ['pdftoppm -png -r 200 -f 1 -singlefile {{file}} page', 'tesseract page.png stdout --psm 6'])
      ]),

    T('unzip', 'unzip', 'ตรวจ ZIP/OOXML container และอ่านไฟล์ภายในโดยไม่เปิด macro', ['Document OSINT', 'Archives'], ['ZIP', 'DOCX', 'PPTX', 'XLSX'],
      'Info-ZIP License', 'https://infozip.sourceforge.net/',
      { mac: 'Built into macOS', linux: 'sudo apt install unzip' },
      ['Encrypted archive → ห้าม password cracking', 'Path traversal risk → list ก่อนและ extract เฉพาะไฟล์'], ['file', 'exiftool'], [
        R('list', 'List archive contents safely', 'ดู filenames/sizes ก่อน extract', ['archive listing', 'DOCX contents', 'embedded files'], ['unzip -l {{file}} | head -100']),
        R('ooxml', 'Read OOXML metadata and text XML', 'อ่าน docProps และ document.xml แบบ local', ['DOCX metadata', 'Office author', 'shared strings'], ['unzip -p {{file}} docProps/core.xml', 'unzip -p {{file}} word/document.xml | sed "s/<[^>]*>/ /g"']),
        R('media', 'Locate embedded media', 'หา image filenames ก่อน extract เฉพาะรายการ', ['embedded image', 'DOCX media', 'PPTX image'], ['unzip -l {{file}} | rg "(word|ppt|xl)/media/"'])
      ]),

    T('jq', 'jq', 'อ่านและกรอง JSON เช่น ffprobe/RDAP อย่าง reproducible', ['Web / Domain', 'Media', 'Encoding'], ['JSON'],
      'MIT', 'https://jqlang.github.io/jq/',
      { mac: 'brew install jq', linux: 'sudo apt install jq' },
      ['Parse error → input ไม่ใช่ JSON หรือถูกตัด', 'null → field ไม่มี ไม่ใช่ empty string'], ['python', 'ripgrep'], [
        R('pretty', 'Validate and pretty-print JSON', 'ตรวจ syntax และโครงสร้างก่อนเลือก field', ['inspect JSON', 'pretty print', 'validate JSON'], ['jq . {{file}}']),
        R('select', 'Select useful fields', 'ลด output ของ RDAP/ffprobe ให้เหลือ field ที่ตอบคำถาม', ['filter JSON', 'RDAP events', 'ffprobe streams'], ['jq ".events, .entities, .nameservers" {{file}}'])
      ]),

    T('file', 'file', 'ระบุชนิดไฟล์จาก magic bytes แทนนามสกุล', ['Triage', 'Images', 'Documents', 'Media', 'Decoded data'],
      ['Any local file'], 'BSD-style', 'https://www.darwinsys.com/file/',
      { mac: 'Built into macOS', linux: 'sudo apt install file' },
      ['Cannot open → path ผิดหรือ permission', 'data → signature ไม่พอ; ใช้ xxd/strings ต่อ'], ['xxd', 'exiftool'], [
        R('identify', 'Identify the real file type', 'ตรวจชนิดจริงก่อนเลือก parser', ['what file is this', 'wrong extension', 'format'], ['file {{file}}']),
        R('mismatch', 'Investigate a misleading extension', 'ตรวจ header และ strings โดยไม่เปิด active content', ['extension mismatch', 'truncated file', 'unknown data'], ['file {{file}}', 'xxd -l 64 {{file}}', 'strings -a -n 8 {{file}} | head -60'])
      ]),

    T('strings', 'strings', 'ดึง printable text จากไฟล์แบบ read-only เพื่อหา URL, ชื่อ หรือ metadata fragment', ['Triage', 'Documents', 'Decoded data'], ['Binary files', 'unknown containers'],
      'GPL-3.0-or-later (GNU binutils); system variants differ', 'https://sourceware.org/binutils/docs/binutils/strings.html',
      { mac: 'Built into macOS (or brew install binutils)', linux: 'sudo apt install binutils' },
      ['Noise สูง → เพิ่ม minimum length', 'Unicode text อาจไม่ปรากฏ → ใช้ parser ของ format'], ['ripgrep', 'xxd'], [
        R('extract', 'Extract readable strings', 'หา text clue โดยไม่ execute ไฟล์', ['embedded text', 'URL', 'creator', 'unknown binary'], ['strings -a -n 6 {{file}} | head -100']),
        R('urls', 'Find URL-like strings', 'กรอง public URL จาก output ที่บันทึกไว้', ['embedded URL', 'domain clue', 'http string'], ['strings -a -n 8 {{file}} | rg -o "https?://[^[:space:]]+"'])
      ]),

    T('xxd', 'xxd', 'ดู bytes และแปลง hex แบบ local', ['Triage', 'Encoding', 'File structure'], ['Any local file', 'hex text'],
      'Vim License', 'https://vimhelp.org/various.txt.html#xxd',
      { mac: 'Built into macOS', linux: 'sudo apt install xxd' },
      ['Non-hex input with -r -p → sanitize and validate first', 'Huge output → limit with -l'], ['file', 'python'], [
        R('header', 'Inspect a file header', 'ดู magic bytes 64 bytes แรก', ['magic bytes', 'file header', 'binary'], ['xxd -l 64 {{file}}']),
        R('decode-hex', 'Convert validated hex to bytes', 'แปลง hex text เป็นไฟล์เพื่อระบุ content', ['hex decode', '48656c6c6f', 'binary output'], ['xxd -r -p input.hex > decoded.bin', 'file decoded.bin', 'xxd -l 64 decoded.bin'])
      ]),

    T('zbarimg', 'ZBar / zbarimg', 'ถอด QR code และ barcode จากภาพในเครื่อง', ['Image OSINT', 'Encoding'], ['PNG', 'JPEG', 'TIFF', 'BMP'],
      'LGPL-2.1-only', 'https://github.com/mchehab/zbar',
      { mac: 'brew install zbar', linux: 'sudo apt install zbar-tools' },
      ['No barcode found → crop/resize/contrast', 'Payload may be URL or text; do not execute/open automatically'], ['imagemagick', 'python'], [
        R('decode', 'Decode a QR or barcode locally', 'อ่านข้อความใน symbol โดยไม่อัปโหลดภาพ', ['QR code', 'barcode', 'encoded URL'], ['zbarimg --quiet {{file}}']),
        R('preprocess', 'Prepare a small QR', 'crop, upscale และ grayscale ก่อน decode', ['small QR', 'blurred barcode', 'QR not detected'], ['magick {{file}} -crop 600x600+100+100 +repage -resize 400% -colorspace Gray qr.png', 'zbarimg --quiet qr.png'])
      ]),

    T('ffprobe', 'ffprobe', 'อ่าน container/stream metadata ของวิดีโอและเสียงแบบ read-only', ['Video / Audio', 'Timeline'], ['MP4', 'MOV', 'MKV', 'WebM', 'WAV', 'MP3', 'AAC'],
      'GPL/LGPL depending build', 'https://ffmpeg.org/ffprobe.html',
      { mac: 'brew install ffmpeg', linux: 'sudo apt install ffmpeg' },
      ['Invalid data → ตรวจ file type/truncation', 'creation_time อาจเป็น export time', 'JSON ใหญ่ → ใช้ jq filter'], ['ffmpeg', 'exiftool', 'jq'], [
        R('inspect', 'Inspect format and streams', 'ดู duration, codec, stream และ tags', ['video metadata', 'duration', 'codec', 'audio stream'], ['ffprobe -v error -show_format -show_streams -of json {{file}}']),
        R('timestamp', 'Inspect media timestamps', 'หา creation_time และ stream tags โดยไม่สับสนกับ upload time', ['video timestamp', 'creation_time', 'recorded date'], ['ffprobe -v error -show_entries format_tags:stream_tags -of json {{file}}']),
        R('streams', 'List concise stream details', 'เลือก video/audio/subtitle stream ที่ต้องการ', ['stream index', 'codec type', 'resolution', 'sample rate'], ['ffprobe -v error -select_streams v:0 -show_entries stream=index,codec_name,width,height,r_frame_rate -of json {{file}}'])
      ]),

    T('ffmpeg', 'FFmpeg', 'สร้าง frame, contact sheet และ audio copy จาก media ในเครื่อง', ['Video / Audio', 'Image OSINT', 'OCR'], ['Video and audio formats supported by build'],
      'GPL/LGPL depending build', 'https://ffmpeg.org/documentation.html',
      { mac: 'brew install ffmpeg', linux: 'sudo apt install ffmpeg' },
      ['Overwrite prompt → ใช้ output ใหม่หรือ -n', 'No such file/directory → สร้าง output directory', 'Timestamp beyond duration → inspect ffprobe first'], ['ffprobe', 'imagemagick', 'tesseract'], [
        R('frame', 'Extract a frame at a timestamp', 'ดึงภาพฉากเป้าหมายเพื่อ OCR/geolocation', ['extract frame', 'video timestamp', 'sign in video'], ['ffmpeg -ss 00:00:30 -i {{file}} -frames:v 1 frame.png']),
        R('interval', 'Extract interval frames', 'เก็บ frame ทุก N วินาทีในช่วงที่ยังไม่รู้เป้าหมาย', ['extract keyframes', 'sample video', 'frames for OCR'], ['mkdir -p frames && ffmpeg -i {{file}} -vf "fps=1/10" frames/%04d.png']),
        R('audio', 'Extract or normalize audio locally', 'แยกเสียงสำหรับฟัง/ถอดเสียงในเครื่อง', ['extract audio', 'announcement', 'speech', 'audio clue'], ['ffmpeg -i {{file}} -vn -ar 16000 -ac 1 speech.wav']),
        R('contact-sheet', 'Create a contact sheet', 'สรุปฉากก่อนเลือกช่วงละเอียด', ['contact sheet', 'long video', 'scene overview'], ['ffmpeg -i {{file}} -vf "fps=1/30,scale=320:-1,tile=4x4" -frames:v 1 sheet.png'])
      ]),

    T('tesseract', 'Tesseract OCR', 'อ่านข้อความจากภาพในเครื่องโดยไม่ส่งภาพออกไปยังบริการภายนอก',
      ['Image OSINT', 'Geolocation', 'Documents', 'Video frames'], ['PNG', 'JPEG', 'TIFF', 'BMP', 'PNM'],
      'Apache-2.0', 'https://tesseract-ocr.github.io/',
      { mac: 'brew install tesseract tesseract-lang', linux: 'sudo apt install tesseract-ocr tesseract-ocr-tha' },
      ['Empty output → crop/resize/contrast ก่อน', 'ภาษาเพี้ยน → ติดตั้ง language pack และใช้ -l', 'Unknown option → ตรวจ tesseract --version'],
      ['imagemagick', 'pdftoppm', 'ripgrep'], [
        R('ocr', 'Extract visible text', 'อ่านข้อความกระจาย เช่น ป้าย ร้าน route number',
          ['extract text from image', 'OCR', 'visible sign', 'storefront', 'route number'],
          ['tesseract {{file}} stdout --psm 11']),
        R('language', 'Specify OCR language', 'ใช้ language model ที่ตรงกับอักษรในภาพ',
          ['Thai OCR', 'language pack', 'mixed language', 'script'],
          ['tesseract {{file}} stdout -l tha+eng --psm 11', 'tesseract --list-langs']),
        R('crop', 'OCR a cropped region', 'อ่านเฉพาะบริเวณที่มีข้อความเพื่อลด noise',
          ['cropped sign', 'small text', 'partial sign', 'region of interest'],
          ['tesseract {{file}} stdout --psm 6']),
        R('preprocess', 'Improve OCR locally', 'สร้าง grayscale/contrast/upscaled copy แล้ว OCR ใหม่',
          ['blurry text', 'low resolution', 'improve OCR', 'contrast', 'upscale'],
          ['magick {{file}} -resize 300% -colorspace Gray -contrast-stretch 1%x1% ocr.png', 'tesseract ocr.png stdout -l eng --psm 6']),
        R('troubleshoot', 'Troubleshoot empty OCR', 'แยกปัญหา input, language, layout และคุณภาพภาพ',
          ['empty OCR', 'garbled text', 'language missing', 'tesseract error'],
          ['tesseract --version', 'tesseract --list-langs', 'magick identify {{file}}'])
      ]),

    T('imagemagick', 'ImageMagick', 'ตรวจ geometry และสร้าง derived images สำหรับ crop, resize, rotate, contrast และ OCR',
      ['Image OSINT', 'OCR', 'Geolocation', 'Local comparison'], ['PNG', 'JPEG', 'TIFF', 'WebP', 'GIF', 'many raster formats'],
      'ImageMagick License', 'https://imagemagick.org/',
      { mac: 'brew install imagemagick', linux: 'sudo apt install imagemagick' },
      ['No decode delegate → format support missing', 'Operation overwrote file → ใช้ output filename ใหม่เสมอ', 'Crop geometry wrong → inspect dimensions first'],
      ['file', 'tesseract', 'ffmpeg'], [
        R('identify', 'Inspect image dimensions', 'ดู format, width, height, channels และ colorspace',
          ['image dimensions', 'resolution', 'format', 'geometry'], ['magick identify {{file}}']),
        R('crop', 'Crop a region', 'ตัดป้าย โลโก้ หรือ UI เป็น derived image',
          ['crop sign', 'region of interest', 'storefront', 'UI'], ['magick {{file}} -crop 900x500+100+200 +repage crop.png']),
        R('resize', 'Resize without replacing original', 'ขยาย clue เล็กเพื่ออ่านและ OCR',
          ['upscale', 'low resolution', 'small sign'], ['magick {{file}} -resize 300% enlarged.png']),
        R('rotate', 'Rotate or deskew', 'ปรับ orientation ของป้าย/เอกสารก่อน OCR',
          ['rotate', 'deskew', 'tilted sign'], ['magick {{file}} -rotate 2 rotated.png', 'magick {{file}} -deskew 40% deskewed.png']),
        R('contrast', 'Grayscale and improve contrast', 'เพิ่ม separation ระหว่างตัวอักษรกับพื้นหลัง',
          ['grayscale', 'contrast', 'faint text', 'OCR preparation'], ['magick {{file}} -colorspace Gray -contrast-stretch 1%x1% contrast.png']),
        R('ocr-prep', 'Complete OCR preparation', 'crop → resize → grayscale → contrast ในคำสั่งเดียว',
          ['prepare image for OCR', 'blurry sign', 'local OCR'], ['magick {{file}} -crop 900x500+100+200 +repage -resize 300% -colorspace Gray -contrast-stretch 1%x1% ocr.png']),
        R('channels', 'Inspect color channels', 'แยก channel เมื่อข้อความต่างสีแต่ luminance ใกล้กัน',
          ['color channel', 'faint overlay', 'colored text'], ['magick {{file}} -separate channel-%d.png']),
        R('compare', 'Compare local candidate images', 'วัดความต่างของไฟล์ candidate ที่มีอยู่ในเครื่อง',
          ['local image comparison', 'perceptual hash', 'candidate match'], ['magick compare -metric PHASH candidate.jpg {{file}} null:'])
      ])
  ];

  window.OSINT_TOOL_DATA = { tools };
}());
