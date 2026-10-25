(function () {
  'use strict';
  const data = window.OSINT_FLOW_DATA;
  if (!data) throw new Error('Load flowcharts.js before extended-flowcharts.js');
  const ref = (tool, task, label) => ({ tool, task, label: label || `${tool} · ${task}` });
  const sets = [
    ['13-CRYPTOGRAPHY', 'Cryptography CTF', [
      ['13-CRYPTO-01-MASTER','Cryptography Master Router',[ref('python','base64'),ref('file','identify'),ref('xxd','header')]],
      ['13-CRYPTO-02-ENCODING','Encoding Recognition',[ref('python','base64'),ref('cyberchef','local-decode'),ref('xxd','header')]],
      ['13-CRYPTO-03-CLASSICAL','Classical Ciphers',[ref('python','unicode'),ref('cyberchef','local-decode')]],
      ['13-CRYPTO-04-XOR','XOR Cryptography',[ref('python','hex'),ref('xxd','decode-hex')]],
      ['13-CRYPTO-05-RSA','RSA Weak CTF Checks',[ref('sympy','number-theory'),ref('rsactftool','weak-key'),ref('sagemath','math')]],
      ['13-CRYPTO-06-HASH','Hash Identification',[ref('hashcat','wordlist'),ref('john','wordlist'),ref('hash','sha256')]],
      ['13-CRYPTO-07-SYMMETRIC','Symmetric Cryptography',[ref('openssl','decrypt'),ref('file','identify'),ref('xxd','header')]],
      ['13-CRYPTO-08-MATH','Mathematical Cryptography',[ref('sympy','number-theory'),ref('sagemath','math')]],
      ['13-CRYPTO-09-CUSTOM','Custom Cipher Audit',[ref('ripgrep','local-search'),ref('python','unicode')]],
      ['13-CRYPTO-10-STUCK-VERIFY','Crypto Stuck & Verify',[ref('file','identify'),ref('xxd','header'),ref('hash','sha256')]]
    ]],
    ['14-DIGITAL-FORENSICS', 'Digital Forensics CTF', [
      ['14-FORENSICS-01-MASTER','Forensics Evidence Router',[ref('file','identify'),ref('hash','sha256'),ref('xxd','header')]],
      ['14-FORENSICS-02-TRIAGE','Initial Evidence Triage',[ref('file','identify'),ref('hash','sha256'),ref('exiftool','all')]],
      ['14-FORENSICS-03-NETWORK','Network Forensics',[ref('tshark','triage'),ref('zeek','logs'),ref('wireshark','follow')]],
      ['14-FORENSICS-04-DISK','Disk & Filesystem',[ref('sleuthkit','filesystem'),ref('autopsy','case'),ref('foremost','carve')]],
      ['14-FORENSICS-05-MEMORY','Memory Forensics',[ref('volatility3','processes'),ref('strings','extract')]],
      ['14-FORENSICS-06-WINDOWS','Windows Artifacts',[ref('evtx','jsonl'),ref('ripgrep','local-search')]],
      ['14-FORENSICS-07-LINUX','Linux Artifacts',[ref('ripgrep','local-search'),ref('shell','preview')]],
      ['14-FORENSICS-08-BROWSER','Browser Forensics',[ref('sqlite3','browser'),ref('python','timestamp')]],
      ['14-FORENSICS-09-DOCUMENT-EMAIL','Document & Email',[ref('pdfinfo','metadata'),ref('pdftotext','extract'),ref('unzip','ooxml')]],
      ['14-FORENSICS-10-IMAGE-MEDIA','Image & Media Forensics',[ref('exiftool','all'),ref('binwalk','scan'),ref('zsteg','scan'),ref('audacity','spectrogram')]],
      ['14-FORENSICS-11-TIMELINE','Timeline Reconstruction',[ref('plaso','timeline'),ref('python','timestamp'),ref('evtx','jsonl')]],
      ['14-FORENSICS-12-DAMAGED','Unknown & Damaged Evidence',[ref('file','mismatch'),ref('xxd','header'),ref('binwalk','scan')]]
    ]],
    ['15-CRYPTO-FORENSICS-PIVOTS', 'Crypto & Forensics Pivots', [
      ['15-PIVOT-01-NETWORK-CHAINS','Network Evidence Chains',[ref('tshark','dns-http'),ref('zeek','logs'),ref('file','identify')]],
      ['15-PIVOT-02-DISK-MEMORY-CHAINS','Disk & Memory Chains',[ref('sleuthkit','extract'),ref('volatility3','processes')]],
      ['15-PIVOT-03-DOCUMENT-BROWSER-CHAINS','Document, Email & Browser Chains',[ref('sqlite3','browser'),ref('pdfinfo','metadata')]],
      ['15-PIVOT-04-MEDIA-CRYPTO-CHAINS','Media & Crypto Chains',[ref('zbarimg','decode'),ref('zsteg','scan'),ref('cyberchef','local-decode')]],
      ['15-PIVOT-05-MIXED-CHAINS','Mixed Evidence Chains',[ref('plaso','timeline'),ref('ripgrep','local-search'),ref('hash','sha256')]]
    ]]
  ];
  for (const [category, categoryLabel, entries] of sets) {
    data.categories.push([category, categoryLabel]);
    for (const [id, title, tools] of entries) data.flows.push({
      id, category, categoryLabel, title,
      svg: `flowcharts/${category}/${id}.svg`,
      png: `flowcharts/${category}/${id}.png`, tools
    });
  }
}());
