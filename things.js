function groupNotes() {
    try {
        console.log("Step 1: Fetching notes and assigning IDs...");

        // 각 노트의 고유 ID와 텍스트를 가져옴
        const notesWithId = notes.map((note, index) => {
            const noteId = index + 1;
            const noteText = note.text;
            console.log(`Note ID: ${noteId}, Text: ${noteText}`);
            return { id: noteId, text: noteText };
        });

        // notesWithId 배열을 기반으로 텍스트를 결합
        console.log("Step 2: Combining notes into notesText...");
        const notesText = notesWithId.map(note => `ID: ${note.id}, 내용: ${note.text}`).join("\n");
        console.log(`Generated notesText: \n${notesText}`);

        // 프롬프트 생성
        console.log("Step 3: Creating the prompt with notesText...");
        const prompt = 
        `You are a UX/UI designer.
        If the core content of the notes is similar, they are considered related.
        An affinity diagram is a grouping technique used to find meaningful patterns within large amounts of data.
        Group similar notes into an affinity diagram based on the following notes: ${notesText}.
        Each note has a unique ID, and you must include both the ID and the content of every note.
        **You must ensure that all notes are included in a group. No note should be left out.**
        출력은 반드시 한국어로 하고, 다음 형식을 따라라:
        - 그룹이름: 내용
          - ID: note ID, 내용: note content`;

        // 최종 프롬프트 출력
        console.log("Step 4: Final prompt:");
        console.log(prompt);

        // API 호출 및 결과 처리
        console.log("Step 5: Calling GPT API...");
        callGPT(prompt, (response) => {
            console.log("Step 6: Response from GPT:");
            console.log(response);
            $('#groups').empty();
            $('#notes').empty();
            addGroupToDisplay(response);
        });

    } catch (error) {
        console.error("An error occurred during the groupNotes process:", error);
    }
}