FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx tsc --skipLibCheck --noEmitOnError false 2>/dev/null || true
RUN ls dist/controllers/ && cat dist/controllers/authController.js | grep -c "otpStore" || echo "OTP NOT FOUND"
EXPOSE 8080
ENV PORT=8080
CMD ["node", "dist/server.js"]
