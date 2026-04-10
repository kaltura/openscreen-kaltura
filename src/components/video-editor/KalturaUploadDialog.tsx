import {
	AlertCircle,
	Check,
	ChevronDown,
	Cloud,
	Loader2,
	Upload,
	X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

interface KalturaUploadDialogProps {
	isOpen: boolean;
	onClose: () => void;
	filePath: string;
	defaultName?: string;
}

interface UploadProgress {
	uploadId: string;
	phase: "uploading" | "processing" | "complete" | "error";
	percentage: number;
	entryId?: string;
	error?: string;
}

export function KalturaUploadDialog({
	isOpen,
	onClose,
	filePath,
	defaultName,
}: KalturaUploadDialogProps) {
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [tags, setTags] = useState("");
	const [selectedCategory, setSelectedCategory] = useState("");
	const [categories, setCategories] = useState<
		Array<{ id: number; name: string; fullName: string }>
	>([]);
	const [isLoadingCategories, setIsLoadingCategories] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
	const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
	const [uploadError, setUploadError] = useState<string | null>(null);
	const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

	// Initialize form and load categories
	useEffect(() => {
		if (!isOpen) return;

		setName(defaultName || filePath.split("/").pop()?.replace(/\.[^.]+$/, "") || "Recording");
		setDescription("");
		setTags("");
		setSelectedCategory("");
		setUploadProgress(null);
		setUploadError(null);
		setIsUploading(false);

		// Load categories
		setIsLoadingCategories(true);
		window.electronAPI
			.kalturaListCategories()
			.then((result) => {
				if (result.success && result.categories) {
					setCategories(result.categories);
				}
			})
			.finally(() => setIsLoadingCategories(false));
	}, [isOpen, filePath, defaultName]);

	// Listen for upload progress
	useEffect(() => {
		if (!isOpen) return;

		const cleanup = window.electronAPI.onKalturaUploadProgress((progress) => {
			setUploadProgress(progress);
			if (progress.phase === "complete") {
				setIsUploading(false);
			} else if (progress.phase === "error") {
				setIsUploading(false);
				setUploadError(progress.error || "Upload failed");
			}
		});

		return cleanup;
	}, [isOpen]);

	const handleUpload = useCallback(async () => {
		if (!name.trim()) return;

		setIsUploading(true);
		setUploadError(null);
		setUploadProgress({ uploadId: "", phase: "uploading", percentage: 0 });

		try {
			const result = await window.electronAPI.kalturaUpload({
				filePath,
				name: name.trim(),
				description: description.trim() || undefined,
				tags: tags.trim() || undefined,
				categoryIds: selectedCategory || undefined,
			});

			if (!result.success) {
				setUploadError(result.error || "Upload failed");
				setIsUploading(false);
			}
			// Success is handled by the progress listener (phase: "complete")
		} catch (error) {
			setUploadError(String(error));
			setIsUploading(false);
		}
	}, [filePath, name, description, tags, selectedCategory]);

	if (!isOpen) return null;

	const isComplete = uploadProgress?.phase === "complete";
	const hasError = uploadProgress?.phase === "error" || uploadError;

	return (
		<>
			<div
				className="fixed inset-0 bg-black/80 backdrop-blur-md z-[70] animate-in fade-in duration-200"
				onClick={isUploading ? undefined : onClose}
			/>
			<div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[80] bg-[#09090b] rounded-2xl shadow-2xl border border-white/10 p-8 w-[90vw] max-w-lg animate-in zoom-in-95 duration-200">
				{/* Header */}
				<div className="flex items-center justify-between mb-6">
					<div className="flex items-center gap-3">
						<div
							className={`w-10 h-10 rounded-full flex items-center justify-center ring-1 ${
								isComplete
									? "bg-emerald-500/20 ring-emerald-500/50"
									: "bg-orange-500/20 ring-orange-500/50"
							}`}
						>
							{isComplete ? (
								<Check className="w-5 h-5 text-emerald-400" />
							) : (
								<Cloud className="w-5 h-5 text-orange-400" />
							)}
						</div>
						<div>
							<span className="text-lg font-bold text-slate-200 block">
								{isComplete ? "Uploaded to Kaltura" : "Upload to Kaltura"}
							</span>
							<span className="text-xs text-slate-500">
								{isComplete
									? `Entry ID: ${uploadProgress?.entryId}`
									: filePath.split("/").pop()}
							</span>
						</div>
					</div>
					{!isUploading && (
						<Button
							variant="ghost"
							size="icon"
							onClick={onClose}
							className="hover:bg-white/10 text-slate-400 hover:text-white rounded-full"
						>
							<X className="w-5 h-5" />
						</Button>
					)}
				</div>

				{/* Success State */}
				{isComplete && (
					<div className="text-center py-6 animate-in zoom-in-95">
						<div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4 ring-1 ring-emerald-500/50">
							<Check className="w-8 h-8 text-emerald-400" />
						</div>
						<p className="text-lg text-slate-200 font-medium mb-1">
							Upload Complete
						</p>
						<p className="text-sm text-slate-400">
							Your recording is now available in Kaltura
						</p>
						<Button
							onClick={onClose}
							className="mt-6 bg-white/10 hover:bg-white/20 text-slate-200"
						>
							Done
						</Button>
					</div>
				)}

				{/* Upload Progress */}
				{isUploading && uploadProgress && !isComplete && (
					<div className="space-y-4 py-2">
						<div className="space-y-2">
							<div className="flex justify-between text-xs font-medium text-slate-400 uppercase tracking-wider">
								<span>
									{uploadProgress.phase === "processing"
										? "Processing"
										: "Uploading"}
								</span>
								<span className="font-mono text-slate-200">
									{uploadProgress.percentage}%
								</span>
							</div>
							<div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
								<div
									className="h-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.3)] transition-all duration-300 ease-out"
									style={{
										width: `${Math.min(uploadProgress.percentage, 100)}%`,
									}}
								/>
							</div>
						</div>
						<p className="text-sm text-slate-400 text-center">
							{uploadProgress.phase === "processing"
								? "Creating media entry in Kaltura..."
								: "Uploading file to Kaltura..."}
						</p>
					</div>
				)}

				{/* Error State */}
				{hasError && !isUploading && !isComplete && (
					<div className="mb-4 animate-in slide-in-from-top-2">
						<div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
							<AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
							<p className="text-sm text-red-400 leading-relaxed">
								{uploadError || uploadProgress?.error || "Upload failed"}
							</p>
						</div>
					</div>
				)}

				{/* Form (only when not uploading/complete) */}
				{!isUploading && !isComplete && (
					<div className="space-y-4">
						<div>
							<label className="text-xs text-slate-400 uppercase tracking-wider block mb-1.5">
								Title *
							</label>
							<input
								type="text"
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="Recording title"
								className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-orange-500/50 focus:border-orange-500/50"
							/>
						</div>

						<div>
							<label className="text-xs text-slate-400 uppercase tracking-wider block mb-1.5">
								Description
							</label>
							<textarea
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								placeholder="Optional description..."
								rows={2}
								className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-orange-500/50 focus:border-orange-500/50 resize-none"
							/>
						</div>

						<div>
							<label className="text-xs text-slate-400 uppercase tracking-wider block mb-1.5">
								Tags
							</label>
							<input
								type="text"
								value={tags}
								onChange={(e) => setTags(e.target.value)}
								placeholder="Comma-separated tags"
								className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-orange-500/50 focus:border-orange-500/50"
							/>
						</div>

						<div className="relative">
							<label className="text-xs text-slate-400 uppercase tracking-wider block mb-1.5">
								Category
							</label>
							<button
								type="button"
								onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
								className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between focus:outline-none focus:ring-1 focus:ring-orange-500/50 focus:border-orange-500/50"
							>
								<span
									className={
										selectedCategory ? "text-slate-200" : "text-slate-600"
									}
								>
									{selectedCategory
										? categories.find(
												(c) => String(c.id) === selectedCategory,
											)?.fullName || "Select category"
										: "Select category (optional)"}
								</span>
								{isLoadingCategories ? (
									<Loader2 className="w-4 h-4 text-slate-500 animate-spin" />
								) : (
									<ChevronDown className="w-4 h-4 text-slate-500" />
								)}
							</button>
							{showCategoryDropdown && categories.length > 0 && (
								<div className="absolute top-full left-0 right-0 mt-1 bg-[#111] border border-white/10 rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto">
									<button
										type="button"
										onClick={() => {
											setSelectedCategory("");
											setShowCategoryDropdown(false);
										}}
										className="w-full px-3 py-2 text-sm text-left text-slate-500 hover:bg-white/5"
									>
										None
									</button>
									{categories.map((cat) => (
										<button
											key={cat.id}
											type="button"
											onClick={() => {
												setSelectedCategory(String(cat.id));
												setShowCategoryDropdown(false);
											}}
											className={`w-full px-3 py-2 text-sm text-left hover:bg-white/5 ${
												String(cat.id) === selectedCategory
													? "text-orange-400"
													: "text-slate-200"
											}`}
										>
											{cat.fullName}
										</button>
									))}
								</div>
							)}
						</div>

						<div className="flex justify-end gap-3 pt-2">
							<Button
								onClick={onClose}
								variant="ghost"
								className="text-slate-300 hover:text-white hover:bg-white/10"
							>
								Cancel
							</Button>
							<Button
								onClick={handleUpload}
								disabled={!name.trim()}
								className="bg-orange-500 hover:bg-orange-600 text-white"
							>
								<Upload className="w-4 h-4 mr-2" />
								Upload
							</Button>
						</div>
					</div>
				)}
			</div>
		</>
	);
}
