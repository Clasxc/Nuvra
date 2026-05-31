// src/components/CourseMaterials.tsx
// Used in both tutor dashboard (can delete) and student dashboard (can download only)

import { useEffect, useState } from "react";
import { getCourseMaterials, deleteMaterial, downloadMaterial } from "@/lib/api";
import type { Material } from "@/lib/api";
import { toast } from "sonner";
import { FileText, Download, Trash2, Upload } from "lucide-react";

interface Props {
  courseId: number;
  courseTitle: string;
  canDelete?: boolean;    // tutors/admins
  canUpload?: boolean;    // tutors/admins — shows upload trigger
  onUploadClick?: () => void;
}

const fileIcon = (filetype: string) => {
  if (filetype === "application/pdf") return "📄";
  if (filetype === "text/plain") return "📝";
  return "📎";
};

const CourseMaterials = ({ courseId, courseTitle, canDelete, canUpload, onUploadClick }: Props) => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = () => {
    getCourseMaterials(courseId)
      .then(setMaterials)
      .catch(() => toast.error("Failed to load materials"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [courseId]);

  const handleDownload = async (material: Material) => {
    setDownloadingId(material.id);
    try {
      await downloadMaterial(material.id, material.filename);
      toast.success(`Downloaded ${material.filename}`);
    } catch {
      toast.error("Download failed");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (material: Material) => {
    if (!confirm(`Delete "${material.filename}"? This will also remove it from the AI index.`)) return;
    setDeletingId(material.id);
    try {
      await deleteMaterial(material.id);
      setMaterials(prev => prev.filter(m => m.id !== material.id));
      toast.success("Material deleted");
    } catch (e: any) {
      toast.error(e.message || "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return (
    <div className="flex justify-center py-6">
      <div className="w-6 h-6 border-2 border-sat-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-600">
          {courseTitle} — {materials.length} file{materials.length !== 1 ? "s" : ""}
        </h3>
        {canUpload && onUploadClick && (
          <button
            onClick={onUploadClick}
            className="flex items-center gap-1.5 text-xs text-sat-primary hover:underline font-medium"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload file
          </button>
        )}
      </div>

      {materials.length === 0 ? (
        <div className="text-center py-6 bg-gray-50 rounded-lg">
          <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No materials uploaded yet</p>
          {canUpload && onUploadClick && (
            <button
              onClick={onUploadClick}
              className="mt-2 text-xs text-sat-primary hover:underline"
            >
              Upload the first file
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {materials.map(material => (
            <div
              key={material.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-lg flex-shrink-0">{fileIcon(material.filetype)}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{material.filename}</p>
                  <p className="text-xs text-gray-400">
                    {material.filetype === "application/pdf" ? "PDF" : "Text file"}
                    {" · "}AI indexed
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                <button
                  onClick={() => handleDownload(material)}
                  disabled={downloadingId === material.id}
                  className="p-1.5 text-gray-400 hover:text-sat-primary transition-colors disabled:opacity-40"
                  title="Download"
                >
                  {downloadingId === material.id
                    ? <div className="w-4 h-4 border-2 border-sat-primary border-t-transparent rounded-full animate-spin" />
                    : <Download className="w-4 h-4" />
                  }
                </button>

                {canDelete && (
                  <button
                    onClick={() => handleDelete(material)}
                    disabled={deletingId === material.id}
                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40"
                    title="Delete"
                  >
                    {deletingId === material.id
                      ? <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                      : <Trash2 className="w-4 h-4" />
                    }
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CourseMaterials;