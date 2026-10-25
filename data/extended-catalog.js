(function () {
  'use strict';
  const data = window.OSINT_TOOL_DATA;
  if (!data) throw new Error('Load catalog.js before extended-catalog.js');
  const A = (text, flow, tool, task) => ({ text, ...(flow ? { flow } : {}), ...(tool ? { tool } : {}), ...(task ? { task } : {}) });
  const R = (id, title, goal, keywords, commands, expected, interpretation, question, yes, no, uncertain, checklist, relatedFlows, relatedTools = []) => ({
    id, title, goal, keywords, commands, expected, interpretation,
    decision: { question, yes, no, uncertain }, checklist, relatedFlows, relatedTools
  });
  const T = (id, name, purpose, categories, formats, license, homepage, mac, linux, errors, alternatives, recipes) => ({
    id, name, purpose, categories, formats, license, homepage,
    install: { mac, linux }, errors, alternatives, recipes
  });
  const baseChecklist = ['ยืนยันว่าเป็นหลักฐาน CTF ที่ได้รับอนุญาต', 'บันทึก hash/ต้นฉบับก่อนทำงาน', 'รันคำสั่งกับ working copy', 'ตรวจ expected output', 'บันทึกผลและข้อจำกัด', 'ยืนยันด้วยหลักฐานอิสระหรือ round trip'];

  const openssl = data.tools.find(tool => tool.id === 'openssl');
  if (openssl) {
    openssl.categories.push('Cryptography');
    openssl.formats.push('encrypted files', 'PEM keys');
    openssl.recipes.push(
      R('decrypt', 'Decrypt with known symmetric parameters', 'ถอด AES เมื่อโจทย์ให้ algorithm/password หรือ key/IV ครบ', ['AES CBC', 'known password', 'PBKDF2', 'decrypt file'],
        ['openssl enc -d -aes-256-cbc -pbkdf2 -in {{file}} -out plain.bin -pass file:password.txt', 'file plain.bin && xxd -l 64 plain.bin'],
        'plain.bin with valid padding and coherent file/text structure', 'โหมด/key/IV เดาไม่ได้จาก ciphertext ล้วน; bad decrypt มักหมายถึง parameter ผิดหรือข้อมูลเสีย', 'Does plaintext validate and round-trip?',
        A('YES — inspect safely and verify','13-CRYPTO-10-STUCK-VERIFY'), A('NO — recheck mode/key/IV/padding','13-CRYPTO-07-SYMMETRIC'), A('UNCERTAIN — inspect header/parameters','13-CRYPTO-07-SYMMETRIC'), baseChecklist, ['13-CRYPTO-07-SYMMETRIC'], ['xxd','file'])
    );
  }
  const python = data.tools.find(tool => tool.id === 'python');
  if (python) python.recipes.push(
    R('base32-85', 'Validate Base32 and Base85', 'ทดสอบ encoding alphabet เพิ่มเติมแบบ local', ['Base32', 'Base85', 'Ascii85', 'MZXW6==='],
      ['python3 -c \'import base64;print(base64.b32decode("JBSWY3DP",casefold=False))\'', 'python3 -c \'import base64;print(base64.b85decode("NM&qnZy"))\''],
      'decoded bytes or a strict decoding exception', 'decode สำเร็จเป็นเพียงหลักฐานสนับสนุน ต้องตรวจ semantic/magic และ round trip', 'Decoded bytes have a coherent type?',
      A('YES — inspect next layer','13-CRYPTO-02-ENCODING'), A('NO — return to classifier','04-TEXT-01-IDENTIFY'), A('UNCERTAIN — inspect bytes',null,'xxd','header'), baseChecklist, ['13-CRYPTO-02-ENCODING'], ['xxd','file']),
    R('jwt', 'Inspect JWT structure without trusting it', 'decode header/payload locally โดยไม่อ้างว่า signature ถูกต้อง', ['JWT', 'three dot-separated sections', 'eyJ'],
      ['python3 -c \'import base64,json;s=open("input.txt").read().strip().split(".");assert len(s)==3;dec=lambda x:base64.urlsafe_b64decode(x+"="*(-len(x)%4));print(json.dumps(json.loads(dec(s[0])),indent=2));print(json.dumps(json.loads(dec(s[1])),indent=2))\''],
      'JSON header and payload; signature segment remains unverified', 'การ decode JWT ไม่ใช่การ verify signature และ claims อาจปลอมได้', 'Is the question only asking for an encoded public clue?',
      A('YES — record claim as unverified clue','04-TEXT-04-WEB-UNICODE'), A('NO — do not treat claims as trusted','13-CRYPTO-10-STUCK-VERIFY'), A('UNCERTAIN — inspect raw segments','04-TEXT-01-IDENTIFY'), baseChecklist, ['04-TEXT-04-WEB-UNICODE','13-CRYPTO-02-ENCODING'], ['jq'])
  );

  data.tools.push(
    T('sympy', 'SymPy', 'คำนวณ number theory และสมการสำหรับโจทย์ Crypto แบบ local', ['Cryptography', 'RSA', 'Math'], ['integers', 'equations', 'RSA parameters'], 'BSD-3-Clause', 'https://docs.sympy.org/',
      'python3 -m venv .venv && . .venv/bin/activate && python3 -m pip install sympy',
      'python3 -m venv .venv && . .venv/bin/activate && python3 -m pip install sympy',
      ['No inverse → gcd(a,m) ≠ 1', 'factorint ช้า → modulus ไม่ใช่ toy/weak', 'integer_nthroot exact=False → hypothesis ใช้ไม่ได้'], ['sagemath', 'python'], [
        R('number-theory', 'GCD, inverse, factors and integer roots', 'ทดสอบความสัมพันธ์เชิงจำนวนแบบ reproducible', ['gcd', 'modular inverse', 'factor RSA', 'integer root'],
          ['python3 -c \'from sympy import gcd,mod_inverse,factorint,integer_nthroot;print(gcd(391,299));print(mod_inverse(17,3120));print(factorint(3233));print(integer_nthroot(64,3))\''],
          '23\n2753\n{53: 1, 61: 1}\n(4, True)', 'ผลเหมาะกับ toy parameters; อย่าใช้ factorint เป็นคำสัญญาว่าจะ factor RSA จริงได้', 'Result satisfies the original equations?',
          A('YES — แทนค่ากลับและไป verify','13-CRYPTO-10-STUCK-VERIFY'), A('NO — ตรวจ parameters/สมมติฐาน','13-CRYPTO-08-MATH'), A('UNCERTAIN — ใช้ Sage กับโครงสร้างขั้นสูง',null,'sagemath','math'), baseChecklist, ['13-CRYPTO-05-RSA','13-CRYPTO-08-MATH'], ['sagemath','rsactftool'])
      ]),
    T('sagemath', 'SageMath', 'ระบบคณิตศาสตร์สำหรับ finite fields, CRT, lattice และ Crypto CTF ขั้นสูง', ['Cryptography', 'RSA', 'Finite fields'], ['Sage scripts', 'integers', 'polynomials'], 'GPL-3.0-or-later', 'https://www.sagemath.org/',
      'conda install -c conda-forge sage', 'sudo apt install sagemath',
      ['แพ็กเกจใหญ่และบาง distro ไม่มีเวอร์ชันล่าสุด', 'inverse_mod ล้มเหลวเมื่อไม่มี inverse', 'lattice attack ต้องมีเงื่อนไขเฉพาะ'], ['sympy'], [
        R('math', 'CRT and modular arithmetic', 'แก้ congruence และตรวจ inverse/power', ['CRT', 'inverse_mod', 'power_mod', 'finite field'],
          ['sage -c "print(inverse_mod(17,3120)); print(crt([2,3],[3,5])); print(power_mod(7,128,13))"'],
          '2753\n8\n3', 'ตรวจผลทุกค่าโดยแทนกลับ modulo เดิม', 'All congruences pass?', A('YES — ใช้ค่าต่อในโจทย์','13-CRYPTO-08-MATH'), A('NO — ตรวจ modulus/order','13-CRYPTO-08-MATH'), A('UNCERTAIN — ลดโจทย์เป็น integer test',null,'sympy','number-theory'), baseChecklist, ['13-CRYPTO-08-MATH','13-CRYPTO-05-RSA'], ['sympy','rsactftool'])
      ]),
    T('rsactftool', 'RsaCtfTool', 'รวมการทดสอบ RSA อ่อนแอสำหรับ toy/CTF semiprime ไม่ใช่ตัวแตก RSA ทั่วไป', ['Cryptography', 'RSA'], ['PEM public keys', 'ciphertext'], 'MIT', 'https://github.com/RsaCtfTool/RsaCtfTool',
      'git clone https://github.com/RsaCtfTool/RsaCtfTool.git && cd RsaCtfTool && python3 -m venv venv && . venv/bin/activate && pip install -e .',
      'git clone https://github.com/RsaCtfTool/RsaCtfTool.git && cd RsaCtfTool && python3 -m venv venv && . venv/bin/activate && pip install -e .',
      ['รองรับ textbook semiprime RSA เป็นหลัก', 'บาง attack ต้อง SageMath', 'Factordb/network attack ส่ง modulus ออกอินเทอร์เน็ต—ไม่ใช้โดยอัตโนมัติ'], ['sympy', 'sagemath'], [
        R('weak-key', 'Audit a weak CTF public key', 'ดึง parameter และลองเฉพาะ weakness ที่เข้าเงื่อนไข', ['given n e c', 'weak RSA', 'Wiener', 'close primes'],
          ['RsaCtfTool --dumpkey --key key.pub', 'RsaCtfTool --publickey key.pub --attack wiener --private', 'RsaCtfTool --publickey key.pub --decryptfile ciphertext'],
          'key parameters, recovered private key หรือ plaintext เมื่อ weakness ใช้ได้', 'ไม่มีผลไม่แปลว่าเครื่องมือเสีย; อาจไม่มี weakness ที่โจทย์ให้มา', 'Private key/plaintext validates mathematically?', A('YES — re-encrypt and verify','13-CRYPTO-10-STUCK-VERIFY'), A('NO — inventory relationships','13-CRYPTO-05-RSA'), A('UNCERTAIN — cheap math tests first',null,'sympy','number-theory'), baseChecklist, ['13-CRYPTO-05-RSA'], ['sympy','sagemath'])
      ]),
    T('cyberchef', 'CyberChef (local)', 'ทดลอง encoding/crypto/compression ใน browser ที่รันจากเครื่องตนเอง', ['Cryptography', 'Encoding', 'Forensics'], ['text', 'bytes', 'files'], 'Apache-2.0', 'https://github.com/gchq/CyberChef',
      'git clone https://github.com/gchq/CyberChef.git && cd CyberChef && npm install && npm run build',
      'git clone https://github.com/gchq/CyberChef.git && cd CyberChef && npm install && npm run build',
      ['ใช้ local build เพื่อความเป็นส่วนตัว', 'DNS/HTTP/Show on map operations อาจทำ network request', 'อย่า execute decoded output'], ['python', 'xxd'], [
        R('local-decode', 'Classify and decode locally', 'ทดสอบ recipe ทีละชั้นโดยไม่ส่ง evidence', ['magic', 'from base64', 'gunzip', 'nested encoding'],
          ['cd CyberChef && npm start'], 'local web app on http://localhost:8080', 'เปิด DevTools Network ถ้ากังวลเรื่อง operation ที่ออกอินเทอร์เน็ต; core transforms อยู่ local', 'Output has a coherent next type?', A('YES — record recipe and inspect type','13-CRYPTO-02-ENCODING'), A('NO — return to pattern classification','04-TEXT-01-IDENTIFY'), A('UNCERTAIN — use strict CLI decoder',null,'python','base64'), baseChecklist, ['13-CRYPTO-02-ENCODING','04-TEXT-05-NESTED-COMPRESSED'], ['python','xxd'])
      ]),
    T('john', 'John the Ripper', 'ตรวจ candidate plaintext กับ hash/archive ของ CTF แบบ offline และได้รับอนุญาต', ['Cryptography', 'Forensics'], ['hash lists', 'supported archives'], 'GPL-2.0-or-later', 'https://github.com/openwall/john',
      'brew install john-jumbo', 'sudo apt install john',
      ['format ambiguous → ใช้ --list=formats และตัวอย่าง', 'wordlist ไม่ครอบคลุมไม่ได้แปลว่าไม่มีคำตอบ', 'ใช้เฉพาะ challenge material'], ['hashcat'], [
        R('wordlist', 'Verify a supplied CTF wordlist', 'ทดสอบ candidate แบบ offline ไม่ทำ credential attack', ['recover CTF hash', 'supplied wordlist', 'archive password'],
          ['john --wordlist=supplied-wordlist.txt hashes.txt', 'john --show hashes.txt'], 'recovered candidate and matching hash line', 'ต้อง recompute/verify กับ exact format อีกครั้ง', 'Candidate verifies?', A('YES — record exact format','13-CRYPTO-10-STUCK-VERIFY'), A('NO — audit hash format','13-CRYPTO-06-HASH'), A('UNCERTAIN — compare Hashcat examples',null,'hashcat','wordlist'), baseChecklist, ['13-CRYPTO-06-HASH'], ['hashcat'])
      ]),
    T('hashcat', 'Hashcat', 'ทดสอบ candidate สำหรับ hash ของ CTF แบบ offline โดยต้องระบุ mode', ['Cryptography', 'Forensics'], ['hash lists', 'wordlists'], 'MIT', 'https://hashcat.net/hashcat/',
      'brew install hashcat', 'sudo apt install hashcat',
      ['-m ผิดทำให้ line-length/signature error', 'อย่าเดา algorithm จากความยาวอย่างเดียว', 'ใช้เฉพาะ challenge material ที่ได้รับอนุญาต'], ['john'], [
        R('wordlist', 'Run a mode-specific wordlist check', 'ตรวจ MD5/SHA ตาม mode ที่ยืนยันแล้ว', ['hashcat mode', 'wordlist', 'offline CTF hash'],
          ['hashcat -m 0 -a 0 hashes.txt supplied-wordlist.txt', 'hashcat -m 0 --show hashes.txt'], 'hash:plaintext for verified candidates', '-m 0 คือ raw MD5 เท่านั้น; format อื่นต้องใช้ mode ที่ตรง official examples', 'Mode and candidate both verified?', A('YES — recompute digest','13-CRYPTO-10-STUCK-VERIFY'), A('NO — identify format first','13-CRYPTO-06-HASH'), A('UNCERTAIN — use official example hashes','13-CRYPTO-06-HASH'), baseChecklist, ['13-CRYPTO-06-HASH'], ['john'])
      ]),
    T('tshark', 'TShark', 'วิเคราะห์ PCAP แบบ CLI ด้วย Wireshark dissectors และ display filters', ['Digital Forensics', 'Network'], ['PCAP', 'PCAPNG'], 'GPL-2.0-or-later', 'https://www.wireshark.org/docs/man-pages/tshark.html',
      'brew install wireshark', 'sudo apt install tshark',
      ['-Y คือ display filter; -f คือ capture filter', 'field ไม่มีใน protocol/version อาจว่าง', 'stream index ต้องหาใน capture จริง'], ['wireshark','zeek','tcpdump'], [
        R('triage', 'Protocol hierarchy and endpoints', 'หา protocol เด่นและคู่สื่อสารก่อน filter ลึก', ['pcap first', 'protocol hierarchy', 'endpoints', 'conversations'],
          ['tshark -r {{file}} -q -z io,phs', 'tshark -r {{file}} -q -z endpoints,ip', 'tshark -r {{file}} -q -z conv,tcp'], 'protocol hierarchy, IP endpoint table, TCP conversation table', 'ปริมาณมากไม่เท่ากับ malicious; ใช้เป็นตัวเลือก branch', 'A focused protocol/endpoint exists?', A('YES — inspect fields/streams','14-FORENSICS-03-NETWORK'), A('NO — inspect timing/other protocols','14-FORENSICS-03-NETWORK'), A('UNCERTAIN — generate Zeek logs',null,'zeek','logs'), baseChecklist, ['14-FORENSICS-03-NETWORK'], ['wireshark','zeek']),
        R('dns-http', 'Extract DNS and HTTP questions', 'ตอบ domain/host/URI/method/POST จาก capture', ['which domain', 'HTTP POST', 'hostname requested', 'downloaded file'],
          ['tshark -r {{file}} -Y dns -T fields -e frame.time_epoch -e ip.src -e dns.qry.name', 'tshark -r {{file}} -Y \'http.request\' -T fields -e frame.number -e ip.src -e http.request.method -e http.host -e http.request.uri'], 'tab-separated packet fields', 'ตรวจทิศทาง request/response และ duplicates/retransmissions', 'Relevant request found?', A('YES — follow exact stream','15-PIVOT-01-NETWORK-CHAINS'), A('NO — inspect TLS/other protocol','14-FORENSICS-03-NETWORK'), A('UNCERTAIN — Wireshark GUI',null,'wireshark','follow'), baseChecklist, ['14-FORENSICS-03-NETWORK','15-PIVOT-01-NETWORK-CHAINS'], ['wireshark']),
        R('follow', 'Follow a TCP stream', 'ดู payload ของ stream ที่เลือกอย่างมีขอบเขต', ['follow TCP stream', 'reconstruct request', 'stream 0'],
          ['tshark -r {{file}} -q -z follow,tcp,ascii,0'], 'two-direction stream transcript with byte counts', 'ASCII อาจแทน non-printable ด้วยจุด; ใช้ raw/hex mode สำหรับ binary', 'Stream contains complete artifact?', A('YES — extract/hash artifact','15-PIVOT-01-NETWORK-CHAINS'), A('NO — try correct stream/protocol','14-FORENSICS-03-NETWORK'), A('UNCERTAIN — inspect in Wireshark',null,'wireshark','follow'), baseChecklist, ['14-FORENSICS-03-NETWORK'], ['wireshark'])
      ]),
    T('wireshark', 'Wireshark', 'GUI packet analysis for protocols, filters, streams and object export', ['Digital Forensics', 'Network'], ['PCAP', 'PCAPNG'], 'GPL-2.0-or-later', 'https://www.wireshark.org/docs/wsug_html/',
      'brew install wireshark', 'sudo apt install wireshark',
      ['Display and capture filters use different syntax', 'Exported objects may be incomplete', 'Do not live-capture unrelated traffic'], ['tshark','zeek'], [
        R('follow', 'Filter and follow a stream', 'ใช้ GUI ยืนยัน packet context และ direction', ['Follow TCP Stream', 'display filter', 'HTTP object'],
          ['wireshark {{file}}'], 'GUI opens capture; Analyze → Display Filters / right-click packet → Follow → TCP Stream', 'เลือก packet/stream ที่เกี่ยวข้องและบันทึก stream number', 'Stream explains the question?', A('YES — hash extracted artifact','15-PIVOT-01-NETWORK-CHAINS'), A('NO — return to hierarchy','14-FORENSICS-03-NETWORK'), A('UNCERTAIN — reproduce with TShark',null,'tshark','follow'), baseChecklist, ['14-FORENSICS-03-NETWORK'], ['tshark','zeek'])
      ]),
    T('tcpdump', 'tcpdump', 'อ่าน capture สรุปและทดสอบ BPF filter อย่างรวดเร็ว', ['Digital Forensics', 'Network'], ['PCAP', 'PCAPNG where supported'], 'BSD-3-Clause', 'https://www.tcpdump.org/manpages/tcpdump.1.html',
      'brew install tcpdump', 'sudo apt install tcpdump',
      ['BPF filter ไม่ใช่ Wireshark display filter', 'dissection จำกัดกว่า TShark', 'ใช้ -nn เพื่อไม่ให้ DNS/service lookup เปลี่ยน output'], ['tshark'], [
        R('read', 'Quick packet summary', 'ดู first packets/hosts/ports โดยไม่ resolve', ['quick pcap', 'packet summary', 'BPF'],
          ['tcpdump -nn -r {{file}} -c 100'], 'timestamp source > destination protocol summary', 'ใช้เพื่อ triage; เปลี่ยนไป TShark เมื่ออยากได้ fields', 'Relevant endpoint appears?', A('YES — focused TShark filter',null,'tshark','triage'), A('NO — protocol hierarchy',null,'tshark','triage'), A('UNCERTAIN — inspect file type','14-FORENSICS-02-TRIAGE'), baseChecklist, ['14-FORENSICS-03-NETWORK'], ['tshark'])
      ]),
    T('zeek', 'Zeek', 'แปลง PCAP เป็น structured connection/DNS/HTTP logs เพื่อ correlation', ['Digital Forensics', 'Network', 'Timeline'], ['PCAP', 'PCAPNG'], 'BSD-3-Clause', 'https://docs.zeek.org/',
      'brew install zeek', 'sudo apt install zeek',
      ['ไม่มี stdout ปกติ—ผลอยู่ใน *.log', 'protocol อาจไม่มี log ถ้าไม่พบ', 'รันใน clean output directory'], ['tshark','jq'], [
        R('logs', 'Generate JSON forensic logs', 'สร้าง conn/dns/http logs ที่ค้นและ join ได้', ['zeek pcap', 'conn.log', 'dns.log', 'http.log'],
          ['mkdir zeek-output && cd zeek-output && zeek -r ../capture.pcapng LogAscii::use_json=T', 'jq -c . conn.log | head -20'], 'conn.log and protocol logs in JSON lines', 'absence of a log can reflect protocol visibility or capture limits', 'Relevant log exists?', A('YES — correlate UID/time/IP','15-PIVOT-01-NETWORK-CHAINS'), A('NO — inspect protocols with TShark',null,'tshark','triage'), A('UNCERTAIN — view weird.log','14-FORENSICS-03-NETWORK'), baseChecklist, ['14-FORENSICS-03-NETWORK','15-PIVOT-01-NETWORK-CHAINS'], ['tshark','jq'])
      ]),
    T('volatility3', 'Volatility 3', 'วิเคราะห์ memory dump พร้อม symbol-aware plugins', ['Digital Forensics', 'Memory'], ['raw memory', 'crash dumps', 'VM memory'], 'Volatility Software License 1.0', 'https://volatility3.readthedocs.io/',
      'python3 -m venv .venv && . .venv/bin/activate && pip install volatility3', 'python3 -m venv .venv && . .venv/bin/activate && pip install volatility3',
      ['เริ่ม windows.info เพื่อเช็ก support/symbols', 'plugin มีต่างกันตาม OS/image', 'ผลว่างไม่พิสูจน์ว่า artifact ไม่มี'], ['strings'], [
        R('processes', 'OS info and process tree', 'หา OS, PID, parent และ command line', ['memory dump', 'running process', 'process tree', 'command line'],
          ['vol -f {{file}} windows.info', 'vol -f {{file}} windows.pslist', 'vol -f {{file}} windows.pstree', 'vol -f {{file}} windows.cmdline'], 'kernel/OS details and PID/PPID/process rows', 'ใช้เวลา/PID/path/parent ร่วมกัน; ชื่อ process อย่างเดียวอ่อน', 'Suspicious process is corroborated?', A('YES — pivot connections/files','15-PIVOT-02-DISK-MEMORY-CHAINS'), A('NO — compare more artifacts','14-FORENSICS-05-MEMORY'), A('UNCERTAIN — plugin/symbol diagnosis','14-FORENSICS-05-MEMORY'), baseChecklist, ['14-FORENSICS-05-MEMORY','15-PIVOT-02-DISK-MEMORY-CHAINS'], ['strings'])
      ]),
    T('sleuthkit', 'The Sleuth Kit', 'อ่าน partition/filesystem metadata และกู้ไฟล์ตาม metadata address', ['Digital Forensics', 'Disk', 'Timeline'], ['raw dd/img', 'supported filesystems'], 'CPL-1.0 / IPL-1.0', 'https://www.sleuthkit.org/sleuthkit/man/',
      'brew install sleuthkit', 'sudo apt install sleuthkit',
      ['-o ใช้ start sector ไม่ใช่ byte offset', 'filesystem support แตกต่างกัน', 'icat output ต้อง validate และ hash'], ['autopsy','foremost'], [
        R('filesystem', 'Partition → filesystem → files', 'หา offset แล้ว list allocated/deleted entries', ['mmls', 'fls', 'deleted file', 'partition offset'],
          ['mmls {{file}}', 'fsstat -o 2048 {{file}}', 'fls -r -p -o 2048 {{file}} | head -100'], 'partition table, filesystem details, metadata addresses', 'แทน 2048 ด้วย start sector ที่ mmls แสดงจริง', 'Target metadata address found?', A('YES — use istat/icat','15-PIVOT-02-DISK-MEMORY-CHAINS'), A('NO — inspect whole image/damage','14-FORENSICS-12-DAMAGED'), A('UNCERTAIN — Autopsy GUI',null,'autopsy','case'), baseChecklist, ['14-FORENSICS-04-DISK'], ['autopsy','foremost']),
        R('extract', 'Extract one file by metadata address', 'กู้ byte stream จาก inode/MFT reference ที่ยืนยัน', ['icat', 'recover deleted file', 'inode'],
          ['istat -o 2048 {{file}} 128', 'icat -o 2048 {{file}} 128 > recovered.bin', 'file recovered.bin && shasum -a 256 recovered.bin'], 'metadata timestamps and a recovered artifact', 'offset/address เป็นตัวอย่าง ต้องแทนจากหลักฐานจริง', 'Recovered object validates?', A('YES — artifact-specific flow','15-PIVOT-02-DISK-MEMORY-CHAINS'), A('NO — wrong address/partial file','14-FORENSICS-12-DAMAGED'), A('UNCERTAIN — inspect carving',null,'foremost','carve'), baseChecklist, ['14-FORENSICS-04-DISK'], ['foremost'])
      ]),
    T('autopsy', 'Autopsy', 'GUI case interface built on The Sleuth Kit for disk/file analysis', ['Digital Forensics', 'Disk'], ['disk images', 'directories'], 'Apache-2.0', 'https://www.autopsy.com/download/',
      'Download the official macOS package if available for your release; otherwise use Linux/Windows host', 'sudo apt install autopsy',
      ['Platform packaging differs', 'ingest may take time and disk space', 'keep image read-only and case output separate'], ['sleuthkit'], [
        R('case', 'Create a read-only analysis case', 'นำ disk image เข้า case แล้ว browse filesystem/timeline', ['Autopsy case', 'disk image GUI', 'deleted files'],
          ['autopsy'], 'local GUI with data source, file tree and ingest results', 'บันทึก case path แยกจาก evidence; confirm partition offset/source', 'Relevant artifact found?', A('YES — export/hash a copy','15-PIVOT-02-DISK-MEMORY-CHAINS'), A('NO — use TSK targeted CLI',null,'sleuthkit','filesystem'), A('UNCERTAIN — inspect image type','14-FORENSICS-02-TRIAGE'), baseChecklist, ['14-FORENSICS-04-DISK'], ['sleuthkit'])
      ]),
    T('bulk_extractor', 'bulk_extractor', 'สแกน feature เช่น URL/email จาก image โดยไม่ parse filesystem', ['Digital Forensics', 'Disk'], ['raw images', 'directories'], 'Public Domain', 'https://github.com/simsong/bulk_extractor',
      'brew install bulk_extractor', 'sudo apt install bulk-extractor',
      ['ผลมี false positives และ context สำคัญ', 'output directory ต้องแยก', 'ไม่แทน filesystem metadata'], ['sleuthkit','ripgrep'], [
        R('features', 'Extract bounded feature lists', 'หา URL/email/domain clue จาก image copy', ['bulk extractor', 'email feature', 'URL feature'],
          ['bulk_extractor -o bulk-output {{file}}', 'rg -n -i "example|keyword" bulk-output'], 'feature files with offsets and context', 'offset/feature เป็น lead ไม่ใช่ proof; กลับไป parser ที่รักษาโครงสร้าง', 'Distinctive feature found?', A('YES — map offset/source','15-PIVOT-05-MIXED-CHAINS'), A('NO — use filesystem workflow','14-FORENSICS-04-DISK'), A('UNCERTAIN — inspect report/index','14-FORENSICS-04-DISK'), baseChecklist, ['14-FORENSICS-04-DISK'], ['sleuthkit','ripgrep'])
      ]),
    T('foremost', 'Foremost', 'file carving จาก signatures บน copy ของ disk/binary', ['Digital Forensics', 'Recovery'], ['raw images', 'binary blobs'], 'Public Domain', 'https://foremost.sourceforge.net/',
      'brew install foremost', 'sudo apt install foremost',
      ['carved files ไม่มี original path/name โดยอัตโนมัติ', 'false positives/partial files พบได้', 'output อาจใช้พื้นที่มาก'], ['sleuthkit','binwalk'], [
        R('carve', 'Carve common file signatures', 'กู้ candidate files เมื่อ filesystem metadata ใช้ไม่ได้', ['file carving', 'deleted image', 'unallocated'],
          ['foremost -i {{file}} -o foremost-output'], 'audit.txt and type-specific output folders', 'validate magic, size, footer and hash; carving does not prove location/owner', 'Carved file is structurally valid?', A('YES — artifact-specific analysis','14-FORENSICS-10-IMAGE-MEDIA'), A('NO — damaged evidence workflow','14-FORENSICS-12-DAMAGED'), A('UNCERTAIN — compare TSK entries',null,'sleuthkit','filesystem'), baseChecklist, ['14-FORENSICS-04-DISK','14-FORENSICS-12-DAMAGED'], ['sleuthkit','binwalk'])
      ]),
    T('binwalk', 'Binwalk', 'ตรวจ signatures/embedded objects และ entropy hints ใน binary', ['Digital Forensics', 'Media', 'Firmware triage'], ['binary', 'images', 'firmware'], 'MIT', 'https://github.com/ReFirmLabs/binwalk',
      'brew install binwalk', 'cargo install binwalk',
      ['v3 packaging ต่างจากรุ่นเก่า', 'signature hit อาจ false positive', 'ใช้ extraction เฉพาะ working copy'], ['file','xxd','foremost'], [
        R('scan', 'Scan embedded signatures', 'หา offset ของไฟล์/ข้อมูลซ้อนโดยไม่แก้ต้นฉบับ', ['embedded archive', 'appended data', 'unknown binary'],
          ['binwalk {{file}}'], 'offset, signature and description table', 'ตรวจ offset ด้วย xxd และ validate carved output แยก', 'Specific signature is corroborated?', A('YES — carve/extract on copy','14-FORENSICS-12-DAMAGED'), A('NO — return to structural triage','14-FORENSICS-02-TRIAGE'), A('UNCERTAIN — inspect bytes',null,'xxd','header'), baseChecklist, ['14-FORENSICS-10-IMAGE-MEDIA','14-FORENSICS-12-DAMAGED'], ['xxd','foremost'])
      ]),
    T('sqlite3', 'sqlite3', 'อ่าน browser/app databases แบบ read-only และค้น schema/timestamps', ['Digital Forensics', 'Browser', 'Mobile backups'], ['SQLite databases'], 'Public Domain', 'https://sqlite.org/cli.html',
      'brew install sqlite', 'sudo apt install sqlite3',
      ['ทำงานกับ copy และเก็บ -wal/-shm คู่กัน', 'schema ต่างตาม browser/version', 'timestamp epoch ต้องตรวจเอกสาร'], ['python','jq'], [
        R('browser', 'Inspect schema and recent rows', 'ค้น table/URL/download โดยไม่เขียน database', ['browser history', 'SQLite', 'downloads', 'visits'],
          ['sqlite3 -readonly {{file}} ".tables"', 'sqlite3 -readonly {{file}} ".schema" | head -120'], 'table names and SQL schema', 'สร้าง SELECT ตาม column จริง อย่า copy query ข้าม browser แบบตาบอด', 'Relevant table exists?', A('YES — query rows and convert time','14-FORENSICS-08-BROWSER'), A('NO — identify database/app','14-FORENSICS-02-TRIAGE'), A('UNCERTAIN — integrity check','14-FORENSICS-08-BROWSER'), baseChecklist, ['14-FORENSICS-08-BROWSER'], ['python'])
      ]),
    T('plaso', 'Plaso / log2timeline', 'สร้าง timeline จาก artifact หลายชนิดสำหรับ correlation', ['Digital Forensics', 'Timeline'], ['disk images', 'directories', 'logs'], 'Apache-2.0', 'https://plaso.readthedocs.io/',
      'Use official Plaso container or supported package; macOS native support varies', 'sudo apt install plaso-tools',
      ['collection อาจช้า/ใหญ่', 'parser support และ timezone ต้องบันทึก', 'timeline ไม่แทนการยืนยัน source artifact'], ['sleuthkit'], [
        R('timeline', 'Build and export a forensic timeline', 'รวม events แล้ว filter ช่วงเวลาที่โจทย์ถาม', ['log2timeline', 'timeline', 'what happened before'],
          ['log2timeline.py timeline.plaso {{file}}', 'psort.py -o l2tcsv timeline.plaso > timeline.csv'], 'timeline database and CSV events', 'เก็บ source/description/parser; ตรวจ clock skew และ semantics', 'Timeline isolates the event?', A('YES — corroborate raw artifacts','14-FORENSICS-11-TIMELINE'), A('NO — narrow parser/time range','14-FORENSICS-11-TIMELINE'), A('UNCERTAIN — manual event table','14-FORENSICS-11-TIMELINE'), baseChecklist, ['14-FORENSICS-11-TIMELINE'], ['sleuthkit'])
      ]),
    T('evtx', 'evtx_dump', 'แปลง Windows EVTX เป็น XML/JSONL แบบ cross-platform', ['Digital Forensics', 'Windows', 'Timeline'], ['EVTX'], 'Apache-2.0', 'https://github.com/omerbenamram/evtx',
      'cargo install evtx', 'cargo install evtx',
      ['default multithreading อาจคืน record ไม่เรียง', 'ใช้ -t 1 เมื่อต้องการ order', 'corrupt records อาจ recover ได้บางส่วน'], ['jq','ripgrep'], [
        R('jsonl', 'Dump ordered EVTX to JSONL', 'ค้น Event ID/process/IP/user พร้อม timestamp', ['Windows Event Log', 'Event ID', 'EVTX', 'PowerShell'],
          ['evtx_dump -o jsonl -t 1 {{file}} > events.jsonl', 'rg -n "EventID|ProcessName|CommandLine|IpAddress" events.jsonl | head -100'], 'one JSON event per line in record order', 'Event ID semantics depend on provider/channel; preserve EventRecordID and raw time', 'Relevant event chain found?', A('YES — build correlated timeline','14-FORENSICS-11-TIMELINE'), A('NO — inspect other channels/artifacts','14-FORENSICS-06-WINDOWS'), A('UNCERTAIN — dump XML too','14-FORENSICS-06-WINDOWS'), baseChecklist, ['14-FORENSICS-06-WINDOWS','14-FORENSICS-11-TIMELINE'], ['jq','ripgrep'])
      ]),
    T('zsteg', 'zsteg', 'ตรวจ PNG/BMP bit-plane/LSB clues สำหรับ CTF media triage', ['Digital Forensics', 'Steganography triage'], ['PNG', 'BMP'], 'MIT', 'https://github.com/zed-0xff/zsteg',
      'gem install zsteg', 'sudo gem install zsteg',
      ['ผลจำนวนมากมี false positives', 'ไม่รองรับทุก format', 'hit ต้อง validate ด้วย magic/context'], ['steghide','binwalk'], [
        R('scan', 'Scan common PNG/BMP channels', 'ตรวจว่ามี payload เฉพาะเจาะจงหรือไม่', ['LSB', 'zsteg', 'PNG hidden data'],
          ['zsteg -a {{file}}'], 'bit-order/channel candidates and possible signatures', 'อย่าถือทุก printable hit เป็นข้อความจริง', 'A candidate has valid magic/context?', A('YES — extract candidate on copy','15-PIVOT-04-MEDIA-CRYPTO-CHAINS'), A('NO — ordinary media workflow','14-FORENSICS-10-IMAGE-MEDIA'), A('UNCERTAIN — inspect channels',null,'imagemagick','channels'), baseChecklist, ['14-FORENSICS-10-IMAGE-MEDIA','15-PIVOT-04-MEDIA-CRYPTO-CHAINS'], ['binwalk','steghide'])
      ]),
    T('steghide', 'steghide', 'ตรวจ/แยก embedded data ใน format ที่รองรับเมื่อโจทย์มี clue ชัด', ['Digital Forensics', 'Steganography triage'], ['JPEG', 'BMP', 'WAV', 'AU'], 'GPL-2.0-or-later', 'https://steghide.sourceforge.net/',
      'No current Homebrew formula verified — use a Linux VM or build the official source', 'sudo apt install steghide',
      ['ต้องมี passphrase หากถูกตั้ง', 'รองรับ format จำกัด', 'ใช้กับ challenge copy เท่านั้น'], ['zsteg','binwalk'], [
        R('info', 'Inspect steghide container', 'ดูว่ามี embedded data ตาม format นี้หรือไม่', ['steghide info', 'embedded file', 'password clue'],
          ['steghide info {{file}}'], 'container capacity and embedded-data prompt when applicable', 'อย่าลอง credential corpus นอกโจทย์; ใช้ clue/passphrase ที่ได้รับ', 'Container is recognized and authorized key exists?', A('YES — extract to separate folder','15-PIVOT-04-MEDIA-CRYPTO-CHAINS'), A('NO — return to media triage','14-FORENSICS-10-IMAGE-MEDIA'), A('UNCERTAIN — inspect signature',null,'binwalk','scan'), baseChecklist, ['14-FORENSICS-10-IMAGE-MEDIA'], ['zsteg','binwalk'])
      ]),
    T('audacity', 'Audacity', 'ตรวจ waveform/spectrogram และฟัง clue เสียงแบบ local', ['Digital Forensics', 'Audio OSINT'], ['WAV', 'FLAC', 'MP3', 'audio'], 'GPL-3.0-or-later', 'https://www.audacityteam.org/',
      'brew install --cask audacity', 'sudo apt install audacity',
      ['อย่า import plug-in ที่ไม่น่าเชื่อถือ', 'spectrogram pattern เป็น clue ไม่ใช่คำตอบอัตโนมัติ', 'เก็บต้นฉบับและ export แยก'], ['ffmpeg','ffprobe'], [
        R('spectrogram', 'Inspect local spectrogram and channels', 'หา tone/Morse/announcement/time clue ที่มองหรือฟังได้', ['audio spectrogram', 'Morse', 'background announcement'],
          ['open -a Audacity {{file}}  # macOS', 'audacity {{file}}  # Kali/Ubuntu'], 'local waveform; choose track menu → Spectrogram', 'จดช่วงเวลา/frequency แล้ว export excerpt แยกถ้าจำเป็น', 'Distinctive clue is repeatable?', A('YES — decode/verify context','15-PIVOT-04-MEDIA-CRYPTO-CHAINS'), A('NO — inspect metadata/audio streams','14-FORENSICS-10-IMAGE-MEDIA'), A('UNCERTAIN — use ffmpeg excerpt',null,'ffmpeg','audio'), baseChecklist, ['14-FORENSICS-10-IMAGE-MEDIA'], ['ffmpeg','ffprobe'])
      ])
  );
}());
