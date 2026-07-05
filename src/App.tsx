/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { 
  FileText, 
  Upload, 
  Copy, 
  Download, 
  Settings, 
  Check, 
  AlertCircle,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Scale,
  Printer,
  Search,
  X,
  FileSpreadsheet,
  Gavel
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import * as pdfjs from "pdfjs-dist";
import { jsPDF } from "jspdf";
import { cn } from "@/src/lib/utils";

// Set up pdfjs worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const drawStyledParagraph = (
  doc: jsPDF, 
  text: string, 
  startX: number, 
  startY: number, 
  maxWidth: number, 
  lineHeight: number = 6
): number => {
  let currentY = startY;
  
  // Parse chunks (bold ***, bold **, italic *)
  const parts = text.split(/(\*\*\*.*?\*\*\*|\*\*.*?\*\*|\*.*?\*)/);
  const chunks = parts.map(part => {
    if (part.startsWith('***') && part.endsWith('***')) {
      return { text: part.slice(3, -3), bold: true, italic: true };
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return { text: part.slice(2, -2), bold: true, italic: false };
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return { text: part.slice(1, -1), bold: false, italic: true };
    }
    return { text: part, bold: false, italic: false };
  }).filter(p => p.text.length > 0);

  // Convert chunks to word and space tokens
  const tokens: Array<{ text: string; bold: boolean; italic: boolean }> = [];
  chunks.forEach(chunk => {
    const subParts = chunk.text.split(/(\s+)/);
    subParts.forEach(sp => {
      if (sp) {
        tokens.push({ text: sp, bold: chunk.bold, italic: chunk.italic });
      }
    });
  });

  let currentX = startX;

  tokens.forEach((token) => {
    // Set style and size
    doc.setFontSize(11);
    doc.setTextColor(50, 50, 50);
    if (token.bold && token.italic) {
      doc.setFont("helvetica", "bolditalic");
    } else if (token.bold) {
      doc.setFont("helvetica", "bold");
    } else if (token.italic) {
      doc.setFont("helvetica", "italic");
    } else {
      doc.setFont("helvetica", "normal");
    }

    const tokenWidth = doc.getTextWidth(token.text);

    // Check if we need to wrap
    if (currentX + tokenWidth > startX + maxWidth) {
      // If the token is just whitespace, skip wrapping it, just go to next line if there's text
      if (token.text.trim() === '') {
        return;
      }
      
      currentY += lineHeight;
      if (currentY > 275) {
        doc.addPage();
        currentY = 20;
      }
      currentX = startX;
    }

    // Skip leading whitespace on a new line
    if (currentX === startX && token.text.trim() === '') {
      return;
    }

    doc.text(token.text, currentX, currentY);
    currentX += tokenWidth;
  });

  return currentY + lineHeight;
};

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [inputMode, setInputMode] = useState<"pdf" | "text">("pdf");
  const [analysisType, setAnalysisType] = useState<"order" | "filac">("order");
  const [pastedText, setPastedText] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem("lex_gemini_api_key") || "");
  const [showSettings, setShowSettings] = useState(false);
  const [copied, setCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem("lex_gemini_api_key", apiKey);
  }, [apiKey]);

  const extractTextFromPDF = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument(arrayBuffer).promise;
      let fullText = "";
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(" ");
        fullText += pageText + "\n";
      }
      return fullText;
    } catch (err) {
      console.error("PDF Extraction error:", err);
      throw new Error("Failed to read PDF. Please ensure it's a valid document.");
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== "application/pdf") {
        setError("Please upload a PDF file.");
        return;
      }
      setFile(selectedFile);
      setError(null);
      setSummary(null);
    }
  };

  const handleSummarize = async () => {
    if (inputMode === "pdf" && !file) return;
    if (inputMode === "text" && !pastedText.trim()) {
      setError("Please paste some legal text to summarize.");
      return;
    }

    setIsProcessing(true);
    setError(null);
    
    try {
      let text = pastedText;
      
      if (inputMode === "pdf" && file) {
        text = await extractTextFromPDF(file);
      }

      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          text, 
          customApiKey: apiKey || undefined,
          analysisType
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401 || (data.error && data.error.toLowerCase().includes("api key"))) {
          setShowSettings(true);
        }
        throw new Error(data.error || "Failed to summarize text");
      }

      setSummary(data.summary);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = () => {
    if (summary) {
      // Clean raw markdown before copying to clipboard if requested, or copy cleanly
      const cleaned = summary.replace(/\*\*\*/g, '').replace(/\*\*/g, '').replace(/\*/g, '');
      navigator.clipboard.writeText(cleaned);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (!summary) return;
    
    const doc = new jsPDF();
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    // Report Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(10, 17, 40); // Dark navy
    doc.text("LexSummarize Analysis Report", margin, y);
    y += 8;

    // Metadata Subtitle
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(197, 160, 89); // Gold Accent
    const typeLabel = analysisType === "filac" ? "Judgment Summary (FILAC Method)" : "Court Order Summary (Standard Mode)";
    doc.text(`Generated: ${new Date().toLocaleDateString()} | Mode: ${typeLabel}`, margin, y);
    y += 12;

    const sections = summary.split(/##\s+/).filter(Boolean);
    
    sections.forEach((section) => {
      const lines = section.split('\n');
      const title = lines[0].trim();
      const contentLines = lines.slice(1);

      if (y > 250) {
        doc.addPage();
        y = 20;
      }

      // Render Section Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(10, 17, 40);
      doc.text(title, margin, y);
      y += 6;

      // Draw horizontal accent line below the header
      doc.setDrawColor(197, 160, 89);
      doc.setLineWidth(0.5);
      doc.line(margin, y - 4, margin + 45, y - 4);

      contentLines.forEach((cline) => {
        const trimmed = cline.trim();
        if (!trimmed) return;

        // Skip horizontal lines or divider patterns
        if (trimmed === '---' || trimmed === '***' || trimmed === '___') return;

        let textToPrint = trimmed;
        let isBullet = false;

        if (trimmed.startsWith('*') || trimmed.startsWith('-') || trimmed.startsWith('•')) {
          textToPrint = trimmed.replace(/^[*•-]\s?/, '').trim();
          isBullet = true;
          
          // Skip if the bullet content is empty, or only contains formatting symbols
          const stripped = textToPrint.replace(/[*_#\-•\s]/g, '');
          if (!stripped) return;
        }

        if (y > 270) {
          doc.addPage();
          y = 20;
        }

        if (isBullet) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);
          doc.setTextColor(197, 160, 89); // Gold bullet accent
          doc.text("•", margin + 4, y);
          
          doc.setFont("helvetica", "normal");
          doc.setTextColor(50, 50, 50);
          y = drawStyledParagraph(doc, textToPrint, margin + 10, y, pageWidth - margin * 2 - 10, 6);
        } else {
          doc.setFont("helvetica", "normal");
          doc.setTextColor(50, 50, 50);
          y = drawStyledParagraph(doc, trimmed, margin, y, pageWidth - margin * 2, 6);
        }
        y += 2;
      });

      y += 8; // Spacer between sections
    });
    
    doc.save(`LexSummarize_${analysisType}_Report.pdf`);
  };

  const handleDownloadDoc = () => {
    if (!summary) return;
    
    // Create an HTML document styled for Word with appropriate margins and formatting
    let html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>`;
    html += `<head><title>LexSummarize Analysis Report</title><style>`;
    html += `body { font-family: "Calibri", "Arial", sans-serif; line-height: 1.6; color: #1a1a1a; padding: 30px; }`;
    html += `h1 { color: #0A1128; font-family: "Georgia", serif; border-bottom: 2px solid #C5A059; padding-bottom: 5px; margin-top: 25px; font-size: 20pt; }`;
    html += `h2 { color: #0A1128; font-family: "Georgia", serif; border-bottom: 1.5px solid #C5A059; padding-bottom: 3px; margin-top: 22px; font-size: 15pt; }`;
    html += `p { margin-bottom: 12px; font-size: 11pt; }`;
    html += `ul { margin-top: 5px; margin-bottom: 12px; padding-left: 20px; list-style-type: disc; }`;
    html += `li { margin-bottom: 6px; font-size: 11pt; }`;
    html += `.highlighted { background-color: #fbf9f4; border-left: 4px solid #C5A059; padding: 12px 15px; margin: 18px 0; }`;
    html += `strong { font-weight: bold; color: #0A1128; }`;
    html += `em { font-style: italic; color: #0A1128; }`;
    html += `</style></head><body>`;

    html += `<div style="text-align: center; margin-bottom: 30px; border-bottom: 3px double #0A1128; padding-bottom: 15px;">`;
    html += `<h1 style="font-size: 24pt; margin-bottom: 5px; color: #0A1128; border-bottom: none; margin-top: 0;">LexSummarize Analysis Report</h1>`;
    html += `<p style="color: #C5A059; font-style: italic; font-size: 10pt; margin-bottom: 0;">Generated: ${new Date().toLocaleDateString()} | Mode: ${analysisType === "filac" ? "Judgment Summary (FILAC Method)" : "Court Order Summary"}</p>`;
    html += `</div>`;

    const sections = summary.split(/##\s+/).filter(Boolean);
    sections.forEach((section) => {
      const lines = section.split('\n');
      const title = lines[0].trim();
      const contentLines = lines.slice(1);

      const isSpecialSection = title.toLowerCase().includes("decision") || 
                              title.toLowerCase().includes("next steps") || 
                              title.toLowerCase().includes("compliance") || 
                              title.toLowerCase().includes("conclusion") ||
                              title.toLowerCase().includes("analysis");

      if (isSpecialSection) {
        html += `<div class="highlighted">`;
      }

      html += `<h2>${title}</h2>`;

      let inList = false;
      contentLines.forEach((cline) => {
        const trimmed = cline.trim();
        if (!trimmed) return;
        if (trimmed === '---' || trimmed === '***' || trimmed === '___') return;

        let textToPrint = trimmed;
        let isBullet = false;

        if (trimmed.startsWith('*') || trimmed.startsWith('-') || trimmed.startsWith('•')) {
          textToPrint = trimmed.replace(/^[*•-]\s?/, '').trim();
          isBullet = true;
          
          // Skip if the bullet content is empty, or only contains formatting symbols
          const stripped = textToPrint.replace(/[*_#\-•\s]/g, '');
          if (!stripped) return;
        }

        // Strip stars and parse bold/italic formatting
        let processedLine = textToPrint;
        processedLine = processedLine
          .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>');

        // Remove any remaining stray asterisks
        processedLine = processedLine.replace(/\*/g, '');

        if (isBullet) {
          if (!inList) {
            html += `<ul>`;
            inList = true;
          }
          html += `<li>${processedLine}</li>`;
        } else {
          if (inList) {
            html += `</ul>`;
            inList = false;
          }
          html += `<p>${processedLine}</p>`;
        }
      });

      if (inList) {
        html += `</ul>`;
      }

      if (isSpecialSection) {
        html += `</div>`;
      }
    });

    html += `</body></html>`;

    const blob = new Blob(['\ufeff' + html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LexSummarize_${analysisType}_Report.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#0A1128] text-white font-sans selection:bg-[#C5A059] selection:text-[#0A1128]">
      {/* Header */}
      <header className="border-b border-[#C5A059]/20 bg-[#0A1128]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#C5A059] rounded-lg">
              <Scale className="w-6 h-6 text-[#0A1128]" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">LexSummarize</h1>
              <p className="text-[10px] uppercase tracking-widest text-[#C5A059] font-medium">Indian Legal AI</p>
            </div>
          </div>

          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-white/5 rounded-full transition-colors text-[#C5A059]"
            title="Settings"
            id="settings-btn"
          >
            <Settings className="w-6 h-6" />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* API Key Modal/Inline */}
        <AnimatePresence>
          {showSettings && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-8 overflow-hidden"
            >
              <div className="bg-white/5 border border-[#C5A059]/30 rounded-xl p-6">
                <label className="block text-sm font-medium text-[#C5A059] mb-2 uppercase tracking-wider">
                  Personal Gemini API Key
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Paste your key here..."
                    className="flex-1 bg-[#0A1128]/50 border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-[#C5A059] outline-none transition-colors"
                  />
                  <button 
                    onClick={() => setShowSettings(false)}
                    className="bg-[#C5A059] text-[#0A1128] px-4 py-2 rounded-lg text-sm font-bold hover:bg-[#D6B570] transition-colors"
                    id="save-key-btn"
                  >
                    Save
                  </button>
                </div>
                <p className="mt-2 text-xs text-white/50 italic">
                  Stored locally in your browser. Leave blank to use app default (if configured).
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hero Section */}
        {!summary && (
          <div className="text-center mb-12">
            <motion.h2 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-4xl md:text-5xl font-serif font-bold mb-4"
            >
              Clarity in Every <span className="text-[#C5A059]">Judgment.</span>
            </motion.h2>
            <motion.p 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-lg text-white/70 max-w-2xl mx-auto leading-relaxed"
            >
              Upload court orders and legal documents for instant, structured summaries. 
              Designed specifically for the nuances of Indian Law.
            </motion.p>
          </div>
        )}

        {/* Input Toggle */}
        {!summary && (
          <div className="flex flex-col items-center gap-4 mb-8">
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setInputMode("pdf")}
                className={cn(
                  "px-6 py-2 rounded-full text-sm font-bold transition-all border",
                  inputMode === "pdf" 
                    ? "bg-[#C5A059] text-[#0A1128] border-[#C5A059]" 
                    : "bg-transparent text-white/50 border-white/10 hover:text-white"
                )}
              >
                Upload PDF
              </button>
              <button
                onClick={() => setInputMode("text")}
                className={cn(
                  "px-6 py-2 rounded-full text-sm font-bold transition-all border",
                  inputMode === "text" 
                    ? "bg-[#C5A059] text-[#0A1128] border-[#C5A059]" 
                    : "bg-transparent text-white/50 border-white/10 hover:text-white"
                )}
              >
                Paste Text
              </button>
            </div>

            {/* Analysis Framework selector */}
            <div className="flex flex-col items-center mt-2">
              <span className="text-[10px] uppercase tracking-widest text-[#C5A059] font-bold mb-2">Select Analysis Framework</span>
              <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 gap-1">
                <button
                  onClick={() => setAnalysisType("order")}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                    analysisType === "order" 
                      ? "bg-[#C5A059] text-[#0A1128]" 
                      : "text-white/70 hover:text-white"
                  )}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Court Order Summary
                </button>
                <button
                  onClick={() => setAnalysisType("filac")}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                    analysisType === "filac" 
                      ? "bg-[#C5A059] text-[#0A1128]" 
                      : "text-white/70 hover:text-white"
                  )}
                >
                  <Gavel className="w-3.5 h-3.5" />
                  Judgment (FILAC)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Upload Section */}
        {!summary && inputMode === "pdf" && (
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className={cn(
              "border-2 border-dashed rounded-3xl p-12 text-center transition-all cursor-pointer",
              file ? "border-[#C5A059] bg-[#C5A059]/5" : "border-white/10 hover:border-[#C5A059]/50 hover:bg-white/5"
            )}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-[#C5A059]'); }}
            onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-[#C5A059]'); }}
            onDrop={(e) => {
              e.preventDefault();
              const droppedFile = e.dataTransfer.files?.[0];
              if (droppedFile && droppedFile.type === "application/pdf") {
                setFile(droppedFile);
                setError(null);
                setSummary(null);
              }
            }}
            id="dropzone"
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept=".pdf" 
              className="hidden" 
            />
            
            <div className="flex flex-col items-center">
              <div className={cn(
                "w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-colors",
                file ? "bg-[#C5A059] text-[#0A1128]" : "bg-white/5 text-[#C5A059]"
              )}>
                {file ? <FileText className="w-8 h-8" /> : <Upload className="w-8 h-8" />}
              </div>
              
              {file ? (
                <div>
                  <h3 className="text-xl font-bold mb-1">{file.name}</h3>
                  <p className="text-sm text-white/50">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              ) : (
                <div>
                  <h3 className="text-xl font-bold mb-1">Upload Decree or Order</h3>
                  <p className="text-sm text-white/50">Drag and drop or click to browse (PDF only)</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Paste Text Section */}
        {!summary && inputMode === "text" && (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative"
          >
            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Paste the legal judgment or court order text here..."
              className="w-full h-64 bg-white/5 border-2 border-white/10 rounded-3xl p-8 text-white focus:border-[#C5A059] outline-none transition-all resize-none font-sans text-base leading-relaxed"
            />
          </motion.div>
        )}

        {/* Action Button */}
        {!summary && (file || pastedText.trim()) && (
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mt-8 flex justify-center"
          >
            <button
              onClick={handleSummarize}
              disabled={isProcessing}
              className="group relative px-8 py-4 bg-[#C5A059] text-[#0A1128] rounded-xl font-bold text-lg hover:shadow-[0_0_30px_rgba(197,160,89,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
              id="summarize-btn"
            >
              <span className="relative z-10 flex items-center gap-2">
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Analyzing Content...
                  </>
                ) : (
                  <>
                    Summarize Legal Text
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </span>
            </button>
          </motion.div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mt-6 p-4 bg-red-500/10 border border-red-500/50 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-red-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm font-medium">{error}</p>
            </div>
            {(error.includes("API key") || error.includes("API Key") || error.includes("quota") || error.includes("limits")) && (
              <button
                onClick={() => setShowSettings(true)}
                className="text-xs font-bold uppercase tracking-wider bg-[#C5A059]/20 hover:bg-[#C5A059]/35 text-[#C5A059] px-3 py-1.5 rounded-lg border border-[#C5A059]/30 transition-all cursor-pointer whitespace-nowrap self-stretch sm:self-auto text-center"
              >
                Open Settings
              </button>
            )}
          </div>
        )}

        {/* Result View */}
        <AnimatePresence>
          {summary && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 bg-[#FDFDFB] rounded-2xl overflow-hidden shadow-2xl shadow-black/40 border border-white/10"
              id="printable-summary-area"
            >
              {/* Print Support CSS */}
              <style>{`
                @media print {
                  body {
                    background: white !important;
                    color: black !important;
                  }
                  body * {
                    visibility: hidden;
                  }
                  #printable-summary-area, #printable-summary-area * {
                    visibility: visible;
                  }
                  #printable-summary-area {
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 100% !important;
                    background: white !important;
                    color: black !important;
                    box-shadow: none !important;
                    border: none !important;
                    padding: 0 !important;
                    margin: 0 !important;
                  }
                  .no-print {
                    display: none !important;
                  }
                }
              `}</style>

              <div className="bg-[#0A1128] px-6 py-6 flex justify-between items-center border-b border-[#C5A059]/20 no-print">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => { setSummary(null); setFile(null); setPastedText(""); setSearchTerm(""); }}
                    className="p-1 hover:bg-white/10 rounded-lg transition-colors text-[#C5A059]"
                    title="Back to upload"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <div className="flex items-center gap-2 text-[#C5A059]">
                    <Scale className="w-5 h-5" />
                    <span className="text-sm font-bold uppercase tracking-widest hidden sm:inline">Judgment Analysis</span>
                  </div>
                </div>
                <button 
                  onClick={() => { setSummary(null); setFile(null); setPastedText(""); setSearchTerm(""); }}
                  className="bg-[#C5A059] text-[#0A1128] px-4 py-2 rounded-lg text-xs font-bold hover:bg-[#D6B570] transition-colors uppercase tracking-widest"
                  id="reset-btn"
                >
                  New Analysis
                </button>
              </div>

              {/* Local Search and Filter */}
              <div className="bg-[#0A1128]/5 border-b border-black/5 p-4 flex flex-col sm:flex-row items-center gap-3 justify-between no-print">
                <div className="relative w-full sm:max-w-md">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Search className="w-4 h-4 text-[#C5A059]" />
                  </span>
                  <input
                    type="text"
                    placeholder="Search terms or filter sections..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 bg-white border border-[#C5A059]/30 rounded-lg text-sm text-[#0A1128] focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059] outline-none transition-all placeholder-black/40"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-black/40 hover:text-black"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {searchTerm && (
                  <div className="text-xs text-black/50 font-medium">
                    Highlighting matches for <span className="text-[#0A1128] font-bold">"{searchTerm}"</span>
                  </div>
                )}
              </div>

              <div className="p-6 md:p-10 text-[#1a1a1a]">
                <div className="space-y-4">
                  {summary.split(/##\s+/).filter(Boolean).map((section, idx) => {
                    const lines = section.split('\n');
                    const title = lines[0].trim();
                    const contentLines = lines.slice(1);
                    
                    const isDecision = title.toLowerCase().includes("decision");
                    const isNextSteps = title.toLowerCase().includes("next steps") || title.toLowerCase().includes("compliance");
                    const isConclusion = title.toLowerCase().includes("conclusion") || title.toLowerCase().includes("analysis");

                    const isMatch = !searchTerm || section.toLowerCase().includes(searchTerm.toLowerCase());

                    const highlightMatches = (text: string, search: string) => {
                      if (!search.trim()) return text;
                      const regex = new RegExp(`(${search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, "gi");
                      const parts = text.split(regex);
                      return parts.map((part, i) => 
                        regex.test(part) ? (
                          <mark key={i} className="bg-[#C5A059]/30 text-[#0A1128] font-bold rounded px-0.5 border-b border-[#C5A059]">
                            {part}
                          </mark>
                        ) : (
                          part
                        )
                      );
                    };

                    const renderFormattedText = (text: string) => {
                      const parts = text.split(/(\*\*\*.*?\*\*\*|\*\*.*?\*\*|\*.*?\*)/);
                      return parts.map((part, i) => {
                        if (part.startsWith('***') && part.endsWith('***')) {
                          return <strong key={i} className="font-bold text-[#0A1128] italic">{highlightMatches(part.slice(3, -3), searchTerm)}</strong>;
                        }
                        if (part.startsWith('**') && part.endsWith('**')) {
                          return <strong key={i} className="font-bold text-[#0A1128]">{highlightMatches(part.slice(2, -2), searchTerm)}</strong>;
                        }
                        if (part.startsWith('*') && part.endsWith('*')) {
                          return <em key={i} className="italic text-[#0A1128] font-semibold">{highlightMatches(part.slice(1, -1), searchTerm)}</em>;
                        }
                        return <span key={i}>{highlightMatches(part, searchTerm)}</span>;
                      });
                    };

                    return (
                      <motion.div 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        key={idx} 
                        whileHover={{ y: -2 }}
                        className={cn(
                          "p-6 rounded-xl transition-all border-2 duration-300",
                          isDecision || isNextSteps || isConclusion
                            ? "bg-[#C5A059]/10 border-[#C5A059]/30 shadow-sm hover:shadow-xl hover:border-[#C5A059] hover:bg-[#C5A059]/15" 
                            : "bg-white/40 shadow-sm border-black/5 hover:shadow-xl hover:border-[#C5A059]/60 hover:bg-white/60",
                          !isMatch && "opacity-25 filter blur-[0.5px] hover:opacity-100 hover:filter-none"
                        )}
                      >
                        <h3 className="text-2xl font-bold font-serif text-[#0A1128] mb-5 flex items-center gap-3 border-b-2 border-[#C5A059]/40 pb-2">
                          <Scale className="w-6 h-6 text-[#C5A059] shrink-0" />
                          {title}
                        </h3>
                         <div className="text-[16px] text-[#2c3e50] leading-relaxed space-y-3">
                           {contentLines.map((cline, cidx) => {
                              const trimmed = cline.trim();
                              if (!trimmed) return null;
                              
                              // Skip horizontal lines or divider patterns
                              if (trimmed === '---' || trimmed === '***' || trimmed === '___') return null;
                              
                              // Check for bullet points
                              if (trimmed.startsWith('*') || trimmed.startsWith('-') || trimmed.startsWith('•')) {
                                const bulletContent = trimmed.replace(/^[*•-]\s?/, '').trim();
                                if (!bulletContent || bulletContent === '---' || bulletContent === '***' || bulletContent === '___') return null;
                                
                                // Skip if the bullet content is empty, or only contains formatting symbols
                                const stripped = bulletContent.replace(/[*_#\-•\s]/g, '');
                                if (!stripped) return null;

                                return (
                                  <div key={cidx} className="flex gap-4 ml-2 group">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#C5A059] mt-2.5 shrink-0 group-hover:scale-150 transition-transform shadow-[0_0_8px_rgba(197,160,89,0.5)]" />
                                    <span className="font-medium text-[#34495e]">{renderFormattedText(bulletContent)}</span>
                                  </div>
                                );
                              }
                              
                              return <p key={cidx}>{renderFormattedText(trimmed)}</p>;
                           })}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-sm px-8 py-6 flex flex-col md:flex-row gap-4 justify-center border-t border-black/5 no-print">
                <button
                  onClick={handleCopy}
                  className="flex items-center justify-center gap-2 px-6 py-3 border-2 border-[#0A1128] text-[#0A1128] rounded-xl font-bold hover:bg-[#0A1128] hover:text-white transition-all active:scale-95 cursor-pointer"
                  id="copy-btn"
                >
                  {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  {copied ? "Copied!" : "Copy Summary"}
                </button>
                <button
                  onClick={handleDownload}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-[#0A1128] text-white rounded-xl font-bold hover:shadow-xl transition-all active:scale-95 cursor-pointer"
                  id="download-btn"
                >
                  <Download className="w-5 h-5" />
                  Download as PDF
                </button>
                <button
                  onClick={handleDownloadDoc}
                  className="flex items-center justify-center gap-2 px-6 py-3 border-2 border-slate-300 text-slate-700 bg-slate-50 rounded-xl font-bold hover:bg-slate-100 hover:text-slate-900 transition-all active:scale-95 cursor-pointer"
                  id="print-btn"
                >
                  <FileText className="w-5 h-5 text-[#C5A059]" />
                  Download as DOCS
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Info */}
      <footer className="max-w-4xl mx-auto px-4 pb-12 text-center text-white/30 text-xs uppercase tracking-widest">
        LexSummarize • Enterprise Grade Legal AI for India • {new Date().getFullYear()}
      </footer>
    </div>
  );
}
