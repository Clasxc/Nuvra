// src/components/DocumentUpload.tsx
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import FadeInSection from "./FadeInSection";
import { uploadDocument, getCourses, isLoggedIn } from "@/lib/api";
import type { Course } from "@/lib/api";
import { useNavigate } from "react-router-dom";

const DocumentUpload = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [error, setError] = useState("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const loggedIn = isLoggedIn();

  useEffect(() => {
    if (loggedIn) {
      getCourses()
        .then((data) => {
          setCourses(data);
          if (data.length > 0) setSelectedCourseId(data[0].id);
        })
        .catch(() => {});
    }
  }, [loggedIn]);

  const handleFileSelect = (selectedFile: File) => {
    const fileType = selectedFile.type;
    if (fileType !== "application/pdf" && fileType !== "text/plain") {
      setError("Only PDF and TXT files are supported");
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError("File size exceeds 10MB limit");
      return;
    }
    setError("");
    setFile(selectedFile);
    setUploadSuccess(false);
  };

  const handleUpload = async () => {
    if (!file || !selectedCourseId) return;
    setIsUploading(true);
    setError("");
    try {
      await uploadDocument(file, selectedCourseId);
      setUploadSuccess(true);
      setFile(null);
    } catch (err: any) {
      setError(err.message || "There was an error uploading your document. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <section id="document-upload" className="py-20 bg-blue-50">
      <div className="container mx-auto px-4">
        <FadeInSection>
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
              Upload Your <span className="text-sat-primary">Study Materials</span>
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Upload your textbooks, notes, or study guides, and our AI will process
              them to answer your specific questions.
            </p>
          </div>
        </FadeInSection>

        <div className="max-w-3xl mx-auto">
          <FadeInSection delay={100}>
            <div className="bg-white rounded-xl shadow-lg p-8">

              {/* Not logged in — prompt to sign in */}
              {!loggedIn ? (
                <div className="text-center py-8">
                  <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-7 h-7 text-sat-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Log in to upload materials</h3>
                  <p className="text-gray-500 text-sm mb-6">
                    Tutors can upload course materials that the AI will use to answer student questions.
                  </p>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => navigate("/login")}
                      className="bg-sat-primary text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-sat-secondary transition-colors"
                    >
                      Log in
                    </button>
                    <button
                      onClick={() => navigate("/signup")}
                      className="border border-gray-300 text-gray-600 px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                    >
                      Sign up
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Course selector */}
                  {courses.length > 0 ? (
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Upload to course
                      </label>
                      <select
                        value={selectedCourseId ?? ""}
                        onChange={(e) => setSelectedCourseId(Number(e.target.value))}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sat-primary focus:border-transparent"
                      >
                        {courses.map((c) => (
                          <option key={c.id} value={c.id}>{c.title}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
                      No courses found. Create a course first before uploading materials.
                    </div>
                  )}

                  {/* Drop zone */}
                  <div
                    className={cn(
                      "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                      isDragging
                        ? "border-sat-primary bg-blue-50"
                        : "border-gray-300 hover:border-sat-primary hover:bg-blue-50"
                    )}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0]);
                    }}
                    onClick={() => document.getElementById("file-upload")?.click()}
                  >
                    <input
                      id="file-upload"
                      type="file"
                      className="hidden"
                      accept=".pdf,.txt"
                      onChange={(e) => e.target.files && handleFileSelect(e.target.files[0])}
                    />
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-lg font-medium text-gray-700 mb-1">
                      {isDragging ? "Drop your file here" : "Drag and drop your file here"}
                    </p>
                    <p className="text-gray-500 text-sm">or click to browse</p>
                    <p className="text-xs text-gray-400 mt-2">PDF or TXT files only (Max 10MB)</p>
                  </div>

                  {/* Selected file */}
                  {file && (
                    <div className="mt-4 p-4 bg-blue-50 rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-sat-primary" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium text-sm">{file.name}</span>
                      </div>
                      <button
                        className="text-red-400 hover:text-red-600"
                        onClick={(e) => { e.stopPropagation(); setFile(null); }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  )}

                  {error && (
                    <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
                  )}

                  {uploadSuccess && (
                    <div className="mt-4 p-4 bg-green-50 text-green-700 rounded-lg flex items-center gap-2 text-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Document uploaded and indexed! You can now ask the AI questions about it.
                    </div>
                  )}

                  <button
                    onClick={handleUpload}
                    disabled={!file || isUploading || !selectedCourseId}
                    className={cn(
                      "w-full mt-6 py-3 rounded-lg font-semibold transition-colors text-sm",
                      !file || isUploading || !selectedCourseId
                        ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                        : "bg-sat-primary text-white hover:bg-sat-secondary"
                    )}
                  >
                    {isUploading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Uploading...
                      </span>
                    ) : "Upload Document"}
                  </button>
                </>
              )}
            </div>
          </FadeInSection>

          {/* How it works */}
          <FadeInSection delay={200}>
            <div className="mt-12 bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">How Document Upload Works</h3>
              <ol className="space-y-3">
                {[
                  "Upload your PDF or TXT document (textbook, notes, practice problems, etc.)",
                  "Our AI processes and indexes the content using ChromaDB embeddings",
                  "Ask specific questions about the material in the AI Assistant",
                  "Get accurate, contextual answers based on your uploaded materials",
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-7 h-7 bg-sat-primary text-white rounded-full flex items-center justify-center text-sm font-semibold">
                      {i + 1}
                    </div>
                    <p className="text-gray-600 text-sm pt-0.5">{step}</p>
                  </li>
                ))}
              </ol>
            </div>
          </FadeInSection>
        </div>
      </div>
    </section>
  );
};

export default DocumentUpload;