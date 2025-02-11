// Wrapping the whole extension in a JS function and calling it immediately 
// (ensures all global variables set in this extension cannot be referenced outside its scope)
(async function(codioIDE, window) {
  
  // Refer to Anthropic's guide on system prompts: https://docs.anthropic.com/claude/docs/system-prompts
  const systemPrompt = `You are a helpful assistant helping students understand programming error messages.

You will be provided with a programming error message in the <error_message> tag.

If the error message does not match any of the generalized ones:
- Carefully review the <assignment> and <code>, if provided, to understand the context of the error
- Explain what is causing the error, and do not provide possible fixes and solutions.
- When referring to code in your explanation, use markdown syntax - wrap inline code with \` and
multiline code with \`\`\`
  `
    
  codioIDE.onErrorState((isError, error) => {
    console.log('codioIDE.onErrorState', {isError, error})
    if (isError) {
      codioIDE.coachBot.showTooltip("I can help explain this error...", () => {
        codioIDE.coachBot.open({id: "errorAugmentButton", params: "tooltip"})
      })
    }
  })

  // register(id: unique button id, name: name of button visible in Coach, function: function to call when button is clicked) 
  codioIDE.coachBot.register("errorAugmentButton", "Test Custom Error Explanation", onButtonPress)

  async function onButtonPress(params) {
    // Function that automatically collects all available context 
    // returns the following object: {guidesPage, assignmentData, files, error}

    let context = await codioIDE.coachBot.getContext()
    console.log(context)

    let input

    if (params == "tooltip") { 
      input = context.error.text
      codioIDE.coachBot.write(context.error.text, codioIDE.coachBot.MESSAGE_ROLES.USER)
    } else {

      try {
        input = await codioIDE.coachBot.input("Please paste the error message you want me to explain!")
      }  catch (e) {
          if (e.message == "Cancelled") {
            codioIDE.coachBot.write("Please feel free to have any other error messages explained!")
            codioIDE.coachBot.showMenu()
            return
          }
      }
    }
   
    
    console.log(input)
    const valPrompt = `<Instructions>

Please determine whether the following text appears to be a programming error message or not:

<text>
${input}
</text>

Output your final Yes or No answer in JSON format with the key 'answer'

Focus on looking for key indicators that suggest the text is an error message, such as:

- Words like "error", "exception", "stack trace", "traceback", etc.

- Line numbers, file names, or function/method names

- Language that sounds like it is reporting a problem or issue

- Language that sounds like it is providing feedback

- Technical jargon related to coding/programming

If you don't see clear signs that it is an error message, assume it is not. Only answer "Yes" if you are quite confident it is an error message. 
If it is not a traditional error message, only answer "Yes" if it sounds like it is providing feedback as part of an automated grading system.

</Instructions>"`

    const validation_result = await codioIDE.coachBot.ask({
        systemPrompt: "You are a helpful assistant.",
        userPrompt: valPrompt
    }, {stream:false, preventMenu: true})

    if (validation_result.result.includes("Yes")) {
        //Define your assistant's userPrompt - this is where you will provide all the context you collected along with the task you want the LLM to generate text for.
        const userPrompt = `Here is the error message:

<error_message>
${input}
</error_message>
 Here is the description of the programming assignment the student is working on:

<assignment>
${context.guidesPage.content}
</assignment>

Here is the student's current code:

<current_code>
${context.files[0]}
</current_code> 

If <assignment> and <current_code> are empty, assume that they're not available. 
With the available context, follow the guidelines and respond with your own error explanation.

Make sure it is verbose, and double check that it does not suggest any fixes or solutions. 
The explanation should only describe the cause of the error. Just provide the explanation in either case only.`

      const result = await codioIDE.coachBot.ask({
        systemPrompt: systemPrompt,
        messages: [{"role": "user", "content": userPrompt}]
      })
    }
    else {
        codioIDE.coachBot.write("This doesn't look like an error. I'm sorry, I can only help you by explaining programming error messages.")
        codioIDE.coachBot.showMenu()
    }
  }

})(window.codioIDE, window)
