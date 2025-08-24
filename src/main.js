import { gsap } from 'gsap';
import { CreateWebWorkerMLCEngine } from "@mlc-ai/web-llm";
import { jsPDF } from "jspdf";

// --- DOM Elements ---
const generateBtn = document.getElementById('generate-btn');
const loader = document.getElementById('loader');
const progressReport = document.getElementById('progress-report');
const resultContainer = document.getElementById('result-container');
const resultText = document.getElementById('result-text');
const motivationalText = document.getElementById('motivational-text');
const chatContainer = document.getElementById('chat-container');
const chatHistory = document.getElementById('chat-history');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');
const exportPdfBtn = document.getElementById('export-pdf-btn');
const exportMdBtn = document.getElementById('export-md-btn');
const exportClaudeBtn = document.getElementById('export-claude-btn');
const typingIndicator = document.getElementById('typing-indicator');
const claudePromptContainer = document.getElementById('claude-prompt-container');
const claudePromptText = document.getElementById('claude-prompt-text');
const copyClaudePromptBtn = document.getElementById('copy-claude-prompt-btn');

// --- Configuration ---
// IDs reales y soportados por WebLLM (actualizado 2025)
const QUICK_MODEL  = "Llama-3.2-3B-Instruct-q4f16_1-MLC";
const DETAIL_MODEL = "Llama-3.1-8B-Instruct-q4f16_1-MLC";

// --- State ---
let quickEngine = null;   // Motor rápido
let detailEngine = null;  // Motor detallado
let activeEngine = null;  // Motor actualmente en uso
let motivationalInterval;
let conversationHistory = [];

const motivationalQuotes = [
  "Preparando una idea revolucionaria...",
  "Buscando en el universo de la creatividad...",
  "Cocinando algo increíble para ti...",
  "Tu próximo gran proyecto está en camino...",
  "Desatando el poder de la inteligencia artificial...",
  "Convirtiendo café en código y en una idea genial...",
  "Afinando los algoritmos de la inspiración...",
  "La espera valdrá la pena",
  "Ya vaaa....",
  "Voy...",
  "Espérate, la magia está por llegar",
  "Hola, soy Cortana, estoy configurando el Windows",
  "Esto es como instalar Debian: va rápido",
  "No te preocupes, no uso JQuery",
  "Esto es más largo que las charlas de Morfeo en Matrix",
  "Joé'",
  "Se me acaban los textos bonitos..."
];

// --- Functions ---

function showSpinner() {
  loader.classList.remove('hidden');
  generateBtn.disabled = true;
  let lastQuote = "";
  motivationalInterval = setInterval(() => {
    let newQuote = lastQuote;
    while (newQuote === lastQuote) {
      newQuote = motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)];
    }
    motivationalText.textContent = newQuote;
    lastQuote = newQuote;
  }, 2000);
}

function hideSpinner() {
  loader.classList.add('hidden');
  generateBtn.disabled = false;
  clearInterval(motivationalInterval);
  motivationalText.textContent = "";
  progressReport.textContent = "";
}

const setProgress = (report) => {
  if (report.text === "Finish loading on WebGPU") {
    hideSpinner();          // <- hides spinner, text and re-enables button
    return;
  }

  if (report.progress && report.progress < 1) {
    const percentage = (report.progress * 100).toFixed(2);
    progressReport.textContent = `${report.text} (${percentage}%)`;
  } else {
    progressReport.textContent = report.text;
  }
};

async function createEngine(modelId) {
  return CreateWebWorkerMLCEngine(
    new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }),
    modelId,
    { initProgressCallback: setProgress }
  );
}

async function initializeEngine() {
  console.log('Pre-cargando motores WebLLM...');
  showSpinner();

  [quickEngine, detailEngine] = await Promise.all([
    createEngine(QUICK_MODEL),
    createEngine(DETAIL_MODEL)
  ]);

  activeEngine = quickEngine; // Por defecto usamos el rápido
  console.log('Ambos motores listos.');
  hideSpinner();
}

function appendToChat(message, sender) {
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('chat-message', `${sender}-message`);
  messageDiv.innerHTML = marked.parse(message);
  chatHistory.appendChild(messageDiv);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

async function handleGenerate() {
  // Ensure engine is initialized before proceeding
  if (!quickEngine || !detailEngine) {
    console.log('Motores no inicializados. Esperando...');
    showSpinner(); // Show spinner while waiting
    await initializeEngine(); // Re-initialize if not ready
    hideSpinner(); // Hide spinner after initialization
  }

  const ideaType = document.querySelector('input[name="idea-type"]:checked').value;
  const difficulty = document.querySelector('input[name="difficulty"]:checked').value;
  const responseSpeed = document.querySelector('input[name="response-speed"]:checked').value;

  // Selecciona el motor correcto según la velocidad
  activeEngine = (responseSpeed === 'quick') ? quickEngine : detailEngine;

  const maxGenLen = (responseSpeed === 'quick') ? 128 : 512;

  // Limpia resultados previos
  resultText.innerHTML = "";
  resultContainer.classList.remove('hidden');
  chatContainer.classList.add('hidden');
  exportPdfBtn.classList.add('hidden');
  exportMdBtn.classList.add('hidden');
  exportClaudeBtn.classList.add('hidden');
  chatHistory.innerHTML = '';

  showSpinner();

  const prompt = `Actúa como un experto estratega de negocios y desarrollador de software senior. Genera una idea de proyecto innovadora y con alto potencial de negocio para un desarrollador de ${ideaType} con un nivel de dificultad de implementación ${difficulty}.

**Instrucciones:**

1.  **Concepto Único:** La idea debe ser original y poco común, evitando clichés y proyectos ya muy vistos. No uses nombres que ya existan. Piensa en nichos de mercado desatendidos o en la combinación inesperada de dos o más campos.
2.  **Análisis de Negocio:**
    *   **Descripción:** Describe la idea en 1-2 párrafos.
    *   **Propuesta de Valor:** Explica claramente por qué es una buena idea de negocio. ¿Qué problema resuelve? ¿Cuál es su potencial de mercado y monetización?
3.  **Análisis Técnico:**
    *   **Dificultad de Programación:** Evalúa la dificultad de implementación en una escala de (Fácil, Medio, Difícil) y justifica brevemente por qué (ej. requiere algoritmos complejos, integración con muchos servicios, etc.). Asegúrate de que la dificultad evaluada coincida con la solicitada (${difficulty}).
    *   **Tecnologías Recomendadas:** Sugiere un stack tecnológico (lenguajes, frameworks, bases de datos, etc.) adecuado para el proyecto.
    *   **Primeros Pasos / Tareas:** Enumera los primeros 3 a 5 pasos o tareas concretas que el desarrollador debería realizar para empezar a construir el proyecto.
4.  **Formato:**
    *   Utiliza Markdown para una presentación clara y estructurada.
    *   Responde íntegramente en Español.
    *   Finaliza con 3-4 emojis que representen la esencia del proyecto.`;

  conversationHistory = [{ role: "user", content: prompt }];

  try {
    const reply = await activeEngine.chat.completions.create({
      messages: conversationHistory,
      stream: true,
      max_gen_len: maxGenLen
    });

    let fullReply = "";
    resultText.innerHTML = "";
    for await (const chunk of reply) {
      const delta = chunk.choices[0]?.delta?.content || "";
      fullReply += delta;
      resultText.innerHTML = marked.parse(fullReply);
    }
    conversationHistory.push({ role: "assistant", content: fullReply });

    // Muestra resultados y chat
    appendToChat(fullReply, 'ai');
    chatContainer.classList.remove('hidden');
    exportPdfBtn.classList.remove('hidden');
    exportMdBtn.classList.remove('hidden');
    exportClaudeBtn.classList.remove('hidden');

  } catch (error) {
    console.error("Error durante la generación:", error);
    resultText.innerHTML = "<p style='color: #ff6b6b;'>Hubo un error al generar la idea. Por favor, intenta de nuevo.</p>";
  } finally {
    hideSpinner();
    generateBtn.textContent = 'Generar Otra Idea';
  }
}

async function handleSendMessage() {
  const message = chatInput.value.trim();
  if (!message || !activeEngine) return;

  appendToChat(message, 'user');
  conversationHistory.push({ role: "user", content: message });
  chatInput.value = "";
  sendChatBtn.disabled = true;

  const responseSpeed = document.querySelector('input[name="response-speed"]:checked').value;
  const maxGenLen = (responseSpeed === 'quick') ? 128 : 512;

  typingIndicator.classList.remove('hidden'); // Show indicator
  console.log('Typing indicator: REMOVED hidden class');

  try {
    const reply = await activeEngine.chat.completions.create({
      messages: conversationHistory,
      stream: true,
      max_gen_len: maxGenLen
    });

    let fullReply = "";
    const aiMessageDiv = document.createElement('div');
    aiMessageDiv.classList.add('chat-message', 'ai-message');
    chatHistory.appendChild(aiMessageDiv);

    for await (const chunk of reply) {
      const delta = chunk.choices[0]?.delta?.content || "";
      fullReply += delta;
      aiMessageDiv.innerHTML = marked.parse(fullReply);
      chatHistory.scrollTop = chatHistory.scrollHeight;
    }
    conversationHistory.push({ role: "assistant", content: fullReply });
    console.log('Typing finished, about to hide indicator.');

  } catch (error) {
    console.error("Error durante el chat:", error);
    appendToChat("Hubo un error al responder. Inténtalo de nuevo.", "ai");
    console.log('Error in chat, about to hide indicator.');
  } finally {
    sendChatBtn.disabled = false;
    typingIndicator.classList.add('hidden'); // Hide indicator
    console.log('Typing indicator: ADDED hidden class in finally block');
  }
}

function handleExportMarkdown() {
  let markdownContent = "# Conversación Devreka! Ideas\n\n";

  conversationHistory.forEach((msg, index) => {
    // Skip the initial detailed prompt sent to the AI
    if (index === 0 && msg.role === 'user' && msg.content.startsWith('Actúa como un experto estratega')) {
      // For the first AI response, which is the idea, format it nicely
      if (conversationHistory[1] && conversationHistory[1].role === 'assistant') {
        markdownContent += "## Tu Próxima Gran Idea:\n\n";
        markdownContent += conversationHistory[1].content + "\n\n";
      }
      return;
    }

    if (msg.role === 'user') {
      markdownContent += `**Tú:** ${msg.content}\n\n`;
    } else if (msg.role === 'assistant') {
      markdownContent += `**IA:** ${msg.content}\n\n`;
    }
  });

  const blob = new Blob([markdownContent], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'devreka-idea-conversacion.md';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function handleExportPDF() {
    const doc = new jsPDF({
        orientation: 'p',
        unit: 'pt',
        format: 'a4'
    });

    const margin = 40;
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = margin;

    const checkPageBreak = (neededHeight) => {
        if (y + neededHeight > pageHeight - margin) {
            doc.addPage();
            y = margin;
        }
    };

    const renderText = (text, options) => {
        const { x, style, size, isListItem } = options;
        doc.setFont('helvetica', style || 'normal');
        doc.setFontSize(size || 10);
        const textLines = doc.splitTextToSize(text, pageWidth - x - margin);
        checkPageBreak(textLines.length * (size || 10) * 1.2);
        if (isListItem) {
            doc.text('•', x - 15, y);
        }
        doc.text(textLines, x, y);
        y += textLines.length * (size || 10) * 1.2;
    };

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    checkPageBreak(20);
    doc.text('Conversación sobre Idea de Proyecto', pageWidth / 2, y, { align: 'center' });
    y += 30;

    for (const msg of conversationHistory) {
        if (msg.role === 'user' && msg.content.startsWith('Actúa como un experto estratega')) {
            continue;
        }

        checkPageBreak(20);
        const sender = msg.role === 'user' ? 'Tú:' : 'IA:';
        const color = msg.role === 'user' ? '#007bff' : '#212529';
        doc.setTextColor(color);
        renderText(sender, { x: margin, style: 'bold', size: 12 });
        doc.setTextColor(0, 0, 0);

        const tokens = marked.lexer(msg.content);

        for (const token of tokens) {
            switch (token.type) {
                case 'heading':
                    renderText(token.text, { x: margin, style: 'bold', size: 16 - token.depth * 2 });
                    break;
                case 'paragraph':
                    renderText(token.text, { x: margin });
                    break;
                case 'list':
                    token.items.forEach(item => {
                        renderText(item.text, { x: margin + 15, isListItem: true });
                    });
                    break;
                case 'space':
                    y += 10;
                    break;
            }
        }
        y += 15; // Space between messages
    }

    doc.save('idea-conversacion.pdf');
}

async function handleExportClaude() {
  if (conversationHistory.length < 2 || !activeEngine) {
    alert("Primero genera una idea.");
    return;
  }

  showSpinner();
  const originalButtonText = exportClaudeBtn.textContent;
  exportClaudeBtn.disabled = true;
  exportClaudeBtn.textContent = 'Generando prompt...';
  claudePromptContainer.classList.remove('hidden');
  claudePromptText.textContent = '';


  try {
    const ideaContent = conversationHistory[1].content;

    const promptGeneratorPrompt = `
Actúa como un experto en "prompt engineering" para modelos de IA generativa.
Tu tarea es crear un prompt para una IA de programación que le pida que desarrolle la siguiente idea de proyecto.
El prompt que generes para la IA debe ser claro, conciso, y seguir las mejores prácticas para obtener resultados de alta calidad.

**Idea de Proyecto Original:**
${ideaContent}

**Instrucciones para el prompt de la IA que vas a generar:**
1. El prompt debe empezar con un saludo amigable y una introducción clara de la tarea.
2. Debe incluir la descripción de la idea, las tecnologías recomendadas y las tareas iniciales, extraídas de la idea original.
3. Debe pedirle a la IA que actúe como un desarrollador de software senior y un mentor.
4. Debe solicitar a la IA que genere una estructura de archivos y el código inicial para el proyecto.
5. Debe instruir a la IA para que explique cada paso del proceso.
6. El prompt debe estar en español.

Genera únicamente el prompt para la IA, sin ningún texto adicional antes o después.
`;

    const reply = await activeEngine.chat.completions.create({
      messages: [{ role: "user", content: promptGeneratorPrompt }],
      stream: true,
    });

    let claudePrompt = "";
    for await (const chunk of reply) {
      const delta = chunk.choices[0]?.delta?.content || "";
      claudePrompt += delta;
      claudePromptText.textContent = claudePrompt;
    }

  } catch (error) {
    console.error("Error al generar el prompt para la IA:", error);
    claudePromptText.textContent = "Hubo un error al generar el prompt para la IA. Revisa la consola.";
  } finally {
    exportClaudeBtn.disabled = false;
    exportClaudeBtn.textContent = originalButtonText;
    hideSpinner();
  }
}


// --- Event Listeners ---
generateBtn.addEventListener('click', handleGenerate);
sendChatBtn.addEventListener('click', handleSendMessage);
chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') handleSendMessage();
});
exportPdfBtn.addEventListener('click', handleExportPDF);
exportMdBtn.addEventListener('click', handleExportMarkdown);
exportClaudeBtn.addEventListener('click', handleExportClaude);
copyClaudePromptBtn.addEventListener('click', () => {
    const originalText = copyClaudePromptBtn.innerHTML;
    navigator.clipboard.writeText(claudePromptText.textContent).then(() => {
        copyClaudePromptBtn.textContent = "¡Copiado!";
        setTimeout(() => {
            copyClaudePromptBtn.innerHTML = originalText;
        }, 2000);
    }).catch(err => {
        console.error('Error al copiar al portapapeles: ', err);
        alert("Error al copiar el prompt. Revisa la consola para más detalles.");
    });
});

// --- Initial Load ---
initializeEngine();

console.log(`
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                5                                                   
                                                55                                                  
                                               255                                                  
                                               5555                                                 
                                               5555                                                 
                                              555555                                                
                                              555555                                                
                                              5555555                                               
                                             55555555                                               
                                             55555555                                               
                                             555555555                                              
                                            5555555555                                              
                                            55555555555                                             
                                           555555555555                                             
                                           5555555555555                                            
                                           5555555555555                                            
                                          555555555555555                                           
                                          555555555555555                                           
                                          5555555555555555                                          
                                      55555555555555555555                                          
                  55555555555555555555555555555555555555555                                         
 5555555555555555555555555555555555555555555555555555555555                                         
        5555555555555555555555555555555555555555555555555555                                        
                               55555f55555555555555555555555                                          
                                            555555555555555555555555555                             
                                         555555555555555555555555555555555555555555552              
                                         555555555555555555555555555555555555555555555555           
                                          555555555555555555555555555552                            
                                           55555555555555                                           
                                           55555555555552                                           
                                            555555555555                                            
                                            555555555555                                            
                                             55555555555                                            
                                              555555555                                             
                                              555555555                                             
                                               55555555                                             
                                               5555555                                              
                                                555555                                              
                                                 55555                                              
                                                 55555                                              
                                                  555                                               
                                                  555                                               
                                                   55                                               
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
`);


