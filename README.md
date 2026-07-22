# This is a backup of RSS's filter database

This is the first big project I have ever worked on, and thus to someone far more experienced than I, is likely a complete dumpster fire. That being said, it works and I am proud of it. This project combines Google Cloud Storage (the filter text files), Firebase (For the database and app hosting), and Algolia (for the searching, sorting, and filtering)

If anyone inexperienced is trying to edit something, I will attempt to lay out the process here (Note that this is likely NOT the best way to do things, but I do not know better):

0. Begrudingly, AI is really good at this kinda stuff so if you feed it my files it should be able to tell you what to do (I recommend Claude but any of them should do)
1. Go to Code -> Download ZIP and extract all
2. You'll want a code editor, I recommend VSCode
3. You'll need to install Node.JS
4. Open the filterDatabase folder in Code (either right click the folder, or File -> Open Folder)
5. Go to Terminal -> New Terminal and type "npm install firebase" (if it says npm is not recognized you need to wait for Node to finish installing, and then restart vscode)
6. Next, "npm install -g firebase-tools"
7. Then, "firebase login". This will open a login page. I currently have rstillings@rapidspectralsolutions.com as an approved email. If you are not Bob, then you will have to have Bob add you to the approved list first. (Firebase console -> Settings -> Users & Permissions)
7. Type "npm start". This will open a local host where you can test your changes (the page updates whenever you save a file)
8. Basically all of my code is in public\index.html or src\App.js. Generally speaking, stuff you see is html and stuff that happens in javascript. 90% of simple text changes will be html.
9. When you are satisfied, type "npm run build". This will compile the new code.
10. When that is done, type "firebase deploy". This will push it to the actual app. It may take a bit to actually show up.